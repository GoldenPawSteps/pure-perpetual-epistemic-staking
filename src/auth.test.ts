import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthenticatedSession,
  loadAuthenticatedSession,
  resetAuthenticatedState,
  saveAuthenticatedState,
  signIn,
  signUp,
} from './auth';
import { createInitialState } from './store';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const originalLocalStorage = globalThis.localStorage;
const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api authentication client', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalLocalStorage) {
      vi.stubGlobal('localStorage', originalLocalStorage);
    }
    if (originalFetch) {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  it('creates an account, stores the token, and returns the session snapshot', async () => {
    const state = createInitialState('Alice');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(201, {
      accountId: 'acct-1',
      accountName: 'Alice',
      state,
      token: 'token-1',
    }));

    const result = await signUp('Alice', 'password123');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.accountId).toBe('acct-1');
    expect(localStorage.getItem('ppes_auth_token_v1')).toBe('token-1');
  });

  it('surfaces backend sign-in errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, {
      error: 'Incorrect password.',
    }));

    const result = await signIn('Alice', 'wrongpass');

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain('Incorrect password');
  });

  it('restores a session with the persisted bearer token', async () => {
    const state = createInitialState('Alice');
    localStorage.setItem('ppes_auth_token_v1', 'token-1');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, {
      accountId: 'acct-1',
      accountName: 'Alice',
      state,
    }));

    const session = await loadAuthenticatedSession();

    expect(session).not.toBeNull();
    expect(session?.accountId).toBe('acct-1');
    expect(session?.state.user.name).toBe('Alice');
  });

  it('saves and resets account state through authenticated api calls', async () => {
    const currentState = createInitialState('Alice');
    const resetState = createInitialState('Alice');
    localStorage.setItem('ppes_auth_token_v1', 'token-1');

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, {
        accountId: 'acct-1',
        accountName: 'Alice',
        state: currentState,
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        accountId: 'acct-1',
        accountName: 'Alice',
        state: resetState,
      }));

    await saveAuthenticatedState('acct-1', currentState);
    const nextState = await resetAuthenticatedState('acct-1', 'Alice');

    const firstCall = vi.mocked(fetch).mock.calls[0];
    expect(firstCall[0]).toBe('/api/state');
    expect(nextState.user.name).toBe('Alice');
    clearAuthenticatedSession();
    expect(localStorage.getItem('ppes_auth_token_v1')).toBeNull();
  });
});