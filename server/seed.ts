/**
 * Demo seed script — run `npm run db:seed` after `npm run db:reset`.
 *
 * Creates 6 claims and 4 user accounts (alice, bob, carol, dave / all use
 * "password123") with realistic trading histories spread over the past two
 * weeks, so the UI starts with rich data the moment you log in.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { costToBuyYes, costToBuyNo, priceYes, priceNo } from '../src/math.js';
import type { Claim, Position, PricePoint, Transaction, TradeType } from '../src/types.js';
import type { StoredAccount } from './store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

const DB_PATH = path.resolve(process.cwd(), 'server-data', 'auth-db.json');
const NOW = Date.now();
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Mutable seed state
// ---------------------------------------------------------------------------

interface ClaimBucket {
  claim: Claim;
  priceHistory: PricePoint[];
}

/** Lightweight mutable view of an account while building seed data. */
interface AccountDraft {
  id: string;
  name: string;
  password: string;
  createdAt: number;
  balance: number;
  transactions: Transaction[];
  positions: Map<string, Position>;
}

const claims: Map<string, ClaimBucket> = new Map();
const accounts: Map<string, AccountDraft> = new Map();

// ---------------------------------------------------------------------------
// Claim factory
// ---------------------------------------------------------------------------

function addClaim(
  title: string,
  description: string,
  daysAgo: number,
): string {
  const id = uuid();
  const createdAt = NOW - daysAgo * DAY;
  const claim: Claim = {
    id,
    title,
    description,
    creatorId: 'seed',
    createdAt,
    yesStake: 0,
    noStake: 0,
  };
  claims.set(id, {
    claim,
    priceHistory: [{ timestamp: createdAt, yesPrice: 0.5, noPrice: 0.5 }],
  });
  return id;
}

// ---------------------------------------------------------------------------
// Account factory
// ---------------------------------------------------------------------------

function addAccount(name: string, daysAgo: number): string {
  const id = uuid();
  accounts.set(id, {
    id,
    name,
    password: 'password123',
    createdAt: NOW - daysAgo * DAY,
    balance: 1.0,
    transactions: [],
    positions: new Map(),
  });
  return id;
}

// ---------------------------------------------------------------------------
// Trade simulator
// ---------------------------------------------------------------------------

function trade(
  accountId: string,
  claimId: string,
  tradeType: TradeType,
  shares: number,
  timestamp: number,
): void {
  const acc = accounts.get(accountId);
  const bucket = claims.get(claimId);
  if (!acc || !bucket) throw new Error(`Unknown account or claim: ${accountId} / ${claimId}`);

  const { claim } = bucket;
  if (timestamp < claim.createdAt) {
    throw new Error(
      `Invalid seed timeline: ${tradeType} for claim "${claim.title}" at ${new Date(timestamp).toISOString()} ` +
      `before claim creation ${new Date(claim.createdAt).toISOString()}`,
    );
  }

  const y = claim.yesStake;
  const n = claim.noStake;

  let tradeCost: number;
  let newY = y;
  let newN = n;

  const pos: Position = acc.positions.get(claimId) ?? { claimId, yesShares: 0, noShares: 0 };

  switch (tradeType) {
    case 'BUY_YES': {
      tradeCost = costToBuyYes(y, n, shares);
      if (tradeCost > acc.balance + 1e-9) {
        console.warn(`Skipping ${acc.name} BUY_YES ${shares} on "${claim.title.slice(0, 30)}…" — insufficient balance`);
        return;
      }
      newY = y + shares;
      pos.yesShares += shares;
      break;
    }
    case 'BUY_NO': {
      tradeCost = costToBuyNo(y, n, shares);
      if (tradeCost > acc.balance + 1e-9) {
        console.warn(`Skipping ${acc.name} BUY_NO ${shares} on "${claim.title.slice(0, 30)}…" — insufficient balance`);
        return;
      }
      newN = n + shares;
      pos.noShares += shares;
      break;
    }
    case 'SELL_YES': {
      const actual = Math.min(shares, pos.yesShares);
      if (actual <= 0) { console.warn(`Skipping SELL_YES — no YES shares`); return; }
      tradeCost = costToBuyYes(y, n, -actual); // negative = receive
      newY = Math.max(0, y - actual);
      pos.yesShares = Math.max(0, pos.yesShares - actual);
      shares = actual;
      break;
    }
    case 'SELL_NO': {
      const actual = Math.min(shares, pos.noShares);
      if (actual <= 0) { console.warn(`Skipping SELL_NO — no NO shares`); return; }
      tradeCost = costToBuyNo(y, n, -actual);
      newN = Math.max(0, n - actual);
      pos.noShares = Math.max(0, pos.noShares - actual);
      shares = actual;
      break;
    }
  }

  // Apply state changes
  acc.balance -= tradeCost;
  claim.yesStake = newY;
  claim.noStake = newN;
  acc.positions.set(claimId, pos);

  // Record transaction
  acc.transactions.push({
    id: uuid(),
    userId: accountId,
    claimId,
    type: tradeType,
    shares,
    cost: tradeCost,
    timestamp,
    yesStakeAfter: newY,
    noStakeAfter: newN,
    balanceAfter: acc.balance,
  });

  // Append price-history point
  bucket.priceHistory.push({
    timestamp,
    yesPrice: priceYes(newY, newN),
    noPrice: priceNo(newY, newN),
  });
}

// ---------------------------------------------------------------------------
// Seed data definition
// ---------------------------------------------------------------------------

// -- Claims -----------------------------------------------------------------

const c0 = addClaim(
  'Artificial general intelligence will be achieved before 2030',
  'An AI system will demonstrate general problem-solving ability across all major human cognitive domains before January 1, 2030.',
  14,
);
const c1 = addClaim(
  'More than 50% of production software will be AI-generated by 2027',
  'Over half of all production code shipped globally will be primarily generated by AI coding assistants by end of 2027.',
  13,
);
const c2 = addClaim(
  'The LMSR cost function C(y,n) = log₂(2ʸ + 2ⁿ) − 1 is a valid LMSR variant',
  'This cost function satisfies all required LMSR properties: convexity, bounded worst-case subsidy, and a proper scoring rule for market prices.',
  11,
);
const c3 = addClaim(
  'Bitcoin will sustain a price above $150,000 for 30 consecutive days before 2027',
  'Bitcoin will trade above $150k for an unbroken 30-day window at some point before January 1, 2027.',
  11,
);
const c4 = addClaim(
  'Remote-first work arrangements will exceed in-office by 2027',
  'More than 50% of knowledge-worker jobs at companies with 100+ employees will be remote-first by the end of 2027.',
  10,
);
const c5 = addClaim(
  'A protein-folding AI will enable a Nobel Prize-winning drug discovery by 2028',
  'At least one Nobel Prize in Medicine or Chemistry will be awarded for a drug or treatment whose design was directly enabled by an AI protein-structure prediction system, before 2028.',
  6,
);

// -- Accounts ---------------------------------------------------------------

const alice = addAccount('alice', 14);
const bob   = addAccount('bob',   13);
const carol = addAccount('carol', 11);
const dave  = addAccount('dave',   6);

// -- Trade sequence ---------------------------------------------------------
// Trades are in chronological order; each mutates shared claim state.

// Day -13: Alice — optimistic about AI, bets YES on AGI + software claims
trade(alice, c0, 'BUY_YES', 0.30, NOW - 13 * DAY);
trade(alice, c1, 'BUY_YES', 0.25, NOW - 13 * DAY + 3_600_000);

// Day -12: Bob — AI skeptic, bets NO on both AI claims
trade(bob, c0, 'BUY_NO', 0.40, NOW - 12 * DAY);
trade(bob, c1, 'BUY_NO', 0.35, NOW - 12 * DAY + 2_700_000);

// Day -11: Carol — believes in the math, also dips into Bitcoin
trade(carol, c2, 'BUY_YES', 0.35, NOW - 11 * DAY);
trade(carol, c3, 'BUY_YES', 0.20, NOW - 11 * DAY + 1_800_000);

// Day -10: Alice — skeptical about Bitcoin run, hedges NO; also backs remote work
trade(alice, c3, 'BUY_NO', 0.20, NOW - 10 * DAY);
trade(alice, c4, 'BUY_YES', 0.15, NOW - 10 * DAY + 5_400_000);

// Day -9: Bob — bullish on Bitcoin, adds YES; also tries the math claim NO
trade(bob, c3, 'BUY_YES', 0.30, NOW -  9 * DAY);
trade(bob, c2, 'BUY_NO',  0.15, NOW -  9 * DAY + 1_200_000);

// Day -8: Carol — sells half her AGI YES after seeing Bob's NO pressure
trade(carol, c0, 'BUY_YES', 0.20, NOW - 8 * DAY);
trade(carol, c0, 'SELL_YES', 0.10, NOW - 8 * DAY + 7_200_000);

// Day -6: Dave joins — small, cautious bets across the board
trade(dave, c0, 'BUY_YES', 0.10, NOW - 6 * DAY);
trade(dave, c4, 'BUY_YES', 0.12, NOW - 6 * DAY + 3_000_000);
trade(dave, c5, 'BUY_YES', 0.10, NOW - 6 * DAY + 6_000_000);

// Day -5: Alice — convinced on protein-folding bet, big YES
trade(alice, c5, 'BUY_YES', 0.22, NOW - 5 * DAY);

// Day -4: Bob — adds more NO on remote work (thinks RTO trend continues)
trade(bob, c4, 'BUY_NO', 0.25, NOW - 4 * DAY);

// Day -3: Carol — diversifies into protein discovery claim
trade(carol, c5, 'BUY_YES', 0.18, NOW - 3 * DAY);
trade(carol, c1, 'BUY_NO',  0.12, NOW - 3 * DAY + 3_600_000);

// Day -2: Dave — sells YES on AGI (took small loss/profit) and buys NO on Bitcoin
trade(dave, c0, 'SELL_YES', 0.05, NOW - 2 * DAY);
trade(dave, c3, 'BUY_NO',  0.10, NOW - 2 * DAY + 5_400_000);

// Day -1: Alice — late conviction trade, doubles down on AGI YES
trade(alice, c0, 'BUY_YES', 0.15, NOW - 1 * DAY);

// ---------------------------------------------------------------------------
// Write the database
// ---------------------------------------------------------------------------

async function writeSeed(): Promise<void> {
  // Hash passwords (in parallel for speed)
  const passwordHashEntries = await Promise.all(
    [...accounts.values()].map(async acc => [acc.id, await bcrypt.hash(acc.password, 10)] as const),
  );
  const passwordHashes = new Map(passwordHashEntries);

  // Build StoredAccount array
  const storedAccounts: StoredAccount[] = [...accounts.values()].map(acc => ({
    id: acc.id,
    name: acc.name,
    normalizedName: acc.name.toLowerCase(),
    passwordHash: passwordHashes.get(acc.id)!,
    createdAt: acc.createdAt,
    balance: acc.balance,
    transactions: acc.transactions,
    positions: [...acc.positions.values()],
  }));

  // Build claims and priceHistory
  const storedClaims = [...claims.values()].map(b => b.claim);
  const priceHistory: Record<string, PricePoint[]> = {};
  for (const [id, bucket] of claims) {
    priceHistory[id] = bucket.priceHistory;
  }

  const db = { accounts: storedAccounts, claims: storedClaims, priceHistory };

  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));

  console.log('Seed written to', DB_PATH);
  console.log();
  console.log('Accounts (all passwords: password123)');
  console.log('--------------------------------------');
  for (const acc of accounts.values()) {
    console.log(`  ${acc.name.padEnd(8)} balance: ${acc.balance.toFixed(4)}`);
  }
  console.log();
  console.log('Claims');
  console.log('------');
  for (const { claim } of claims.values()) {
    const yp = priceYes(claim.yesStake, claim.noStake);
    console.log(`  [YES ${(yp * 100).toFixed(1).padStart(5)}%]  ${claim.title.slice(0, 60)}`);
  }
}

writeSeed().catch(err => { console.error(err); process.exit(1); });
