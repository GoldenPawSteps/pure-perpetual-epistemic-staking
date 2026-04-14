import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { AppState, Claim, Position, PricePoint, Transaction } from '../src/types.js';
import { createDemoClaimsData } from '../src/initialState.js';

export interface StoredAccount {
  id: string;
  name: string;
  normalizedName: string;
  passwordHash: string;
  createdAt: number;
  balance: number;
  transactions: Transaction[];
  positions: Position[];
}

// Legacy on-disk format had a full `state: AppState` embedded in the account.
interface LegacyAccount extends Omit<StoredAccount, 'balance' | 'transactions' | 'positions'> {
  state?: AppState;
  balance?: number;
  transactions?: Transaction[];
  positions?: Position[];
}

interface DatabaseShape {
  accounts: StoredAccount[];
  claims: Claim[];
  priceHistory: Record<string, PricePoint[]>;
}

export interface SessionSnapshot {
  accountId: string;
  accountName: string;
  state: AppState;
}

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'server-data', 'auth-db.json');

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function generateId(): string {
  return crypto.randomUUID();
}

function freshDb(): DatabaseShape {
  const demo = createDemoClaimsData();
  return { accounts: [], claims: demo.claims, priceHistory: demo.priceHistory };
}

async function ensureDatabaseFile(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, JSON.stringify(freshDb(), null, 2));
  }
}

export class AuthStore {
  constructor(private readonly filePath = DEFAULT_DB_PATH) {}

  private async readDb(): Promise<DatabaseShape> {
    await ensureDatabaseFile(this.filePath);
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!Array.isArray(parsed.accounts)) {
        return freshDb();
      }

      // Migrate legacy accounts that have a nested `state` property.
      const rawAccounts = parsed.accounts as LegacyAccount[];
      const globalClaims: Claim[] = Array.isArray(parsed.claims) ? (parsed.claims as Claim[]) : [];
      const globalPriceHistory: Record<string, PricePoint[]> =
        parsed.priceHistory != null && typeof parsed.priceHistory === 'object' && !Array.isArray(parsed.priceHistory)
          ? (parsed.priceHistory as Record<string, PricePoint[]>)
          : {};

      const accounts: StoredAccount[] = rawAccounts.map(acc => {
        if (acc.state) {
          // Old format — lift claims to global (deduplicate) and keep per-user fields.
          for (const claim of acc.state.claims) {
            if (!globalClaims.some(c => c.id === claim.id)) {
              globalClaims.push(claim);
            }
          }
          for (const [id, points] of Object.entries(acc.state.priceHistory ?? {})) {
            if (!globalPriceHistory[id]) {
              globalPriceHistory[id] = points;
            }
          }
          return {
            id: acc.id,
            name: acc.name,
            normalizedName: acc.normalizedName,
            passwordHash: acc.passwordHash,
            createdAt: acc.createdAt,
            balance: acc.state.user.balance,
            transactions: acc.state.transactions,
            positions: acc.state.positions,
          };
        }
        return {
          id: acc.id,
          name: acc.name,
          normalizedName: acc.normalizedName,
          passwordHash: acc.passwordHash,
          createdAt: acc.createdAt,
          balance: acc.balance ?? 1,
          transactions: acc.transactions ?? [],
          positions: acc.positions ?? [],
        };
      });

      return { accounts, claims: globalClaims, priceHistory: globalPriceHistory };
    } catch {
      return freshDb();
    }
  }

  private async writeDb(db: DatabaseShape): Promise<void> {
    await ensureDatabaseFile(this.filePath);
    await writeFile(this.filePath, JSON.stringify(db, null, 2));
  }

  private toSessionSnapshot(account: StoredAccount, db: DatabaseShape): SessionSnapshot {
    return {
      accountId: account.id,
      accountName: account.name,
      state: {
        user: { id: account.id, name: account.name, balance: account.balance },
        claims: db.claims,
        transactions: account.transactions,
        positions: account.positions,
        priceHistory: db.priceHistory,
      },
    };
  }

  async createAccount(name: string, password: string): Promise<SessionSnapshot> {
    const trimmedName = name.trim();
    const normalizedName = normalizeName(trimmedName);
    const db = await this.readDb();

    if (!trimmedName) {
      throw new Error('Please enter a name.');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    if (db.accounts.some(account => account.normalizedName === normalizedName)) {
      throw new Error('That name is already registered.');
    }

    const account: StoredAccount = {
      id: generateId(),
      name: trimmedName,
      normalizedName,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: Date.now(),
      balance: 1,
      transactions: [],
      positions: [],
    };

    await this.writeDb({ ...db, accounts: [...db.accounts, account] });
    return this.toSessionSnapshot(account, db);
  }

  async authenticate(name: string, password: string): Promise<SessionSnapshot> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.normalizedName === normalizeName(name));

    if (!account) {
      throw new Error('No account found with that name.');
    }

    const passwordMatches = await bcrypt.compare(password, account.passwordHash);
    if (!passwordMatches) {
      throw new Error('Incorrect password.');
    }

    return this.toSessionSnapshot(account, db);
  }

  async getSession(accountId: string): Promise<SessionSnapshot | null> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.id === accountId);
    return account ? this.toSessionSnapshot(account, db) : null;
  }

  async saveState(accountId: string, state: AppState): Promise<SessionSnapshot | null> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.id === accountId);
    if (!account) {
      return null;
    }

    // Extract per-user fields from the submitted state.
    account.balance = state.user.balance;
    account.transactions = state.transactions;
    account.positions = state.positions;

    // Merge claims: submitted claims are authoritative (carry latest yesStake/noStake).
    for (const claim of state.claims) {
      const idx = db.claims.findIndex(c => c.id === claim.id);
      if (idx >= 0) {
        db.claims[idx] = claim;
      } else {
        db.claims.push(claim);
      }
    }

    // Merge priceHistory similarly.
    for (const [id, points] of Object.entries(state.priceHistory)) {
      db.priceHistory[id] = points;
    }

    await this.writeDb(db);
    return this.toSessionSnapshot(account, db);
  }

  async resetState(accountId: string): Promise<SessionSnapshot | null> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.id === accountId);
    if (!account) {
      return null;
    }

    // Reset only per-user data; global claims are unchanged.
    account.balance = 1;
    account.transactions = [];
    account.positions = [];

    await this.writeDb(db);
    return this.toSessionSnapshot(account, db);
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.id === accountId);
    if (!account) {
      throw new Error('Account not found.');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!passwordMatches) {
      throw new Error('Current password is incorrect.');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    account.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.writeDb(db);
  }

  async deleteAccount(accountId: string, password: string): Promise<void> {
    const db = await this.readDb();
    const account = db.accounts.find(candidate => candidate.id === accountId);
    if (!account) {
      throw new Error('Account not found.');
    }

    const passwordMatches = await bcrypt.compare(password, account.passwordHash);
    if (!passwordMatches) {
      throw new Error('Password is incorrect.');
    }

    await this.writeDb({ ...db, accounts: db.accounts.filter(a => a.id !== accountId) });
  }
}
