import type { AppState } from './types';
import { isValidAppState } from './stateValidation';

export interface SessionSnapshot {
  accountId: string;
  accountName: string;
  state: AppState;
}

interface ApiSessionSnapshot extends SessionSnapshot {
  token?: string;
}

export type AuthSuccess = { ok: true } & SessionSnapshot;
export type AuthFailure = { ok: false; error: string };
export type AuthResponse = AuthSuccess | AuthFailure;

const TOKEN_KEY = 'ppes_auth_token_v1';

function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function writeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ error: 'Request failed.' }));
    const message = typeof errorPayload.error === 'string' ? errorPayload.error : 'Request failed.';
    if (response.status === 401) {
      clearAuthenticatedSession();
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function toAuthSuccess(snapshot: ApiSessionSnapshot): AuthSuccess {
  if (!isValidAppState(snapshot.state)) {
    throw new Error('Server returned invalid app state.');
  }

  return {
    ok: true,
    accountId: snapshot.accountId,
    accountName: snapshot.accountName,
    state: snapshot.state,
  };
}

export async function saveAuthenticatedState(_accountId: string, state: AppState): Promise<void> {
  await requestJson<ApiSessionSnapshot>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ state }),
  });
}

export function clearAuthenticatedSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requestJson<void>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to change password.' };
  }
}

export async function deleteAccount(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requestJson<void>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    clearAuthenticatedSession();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to delete account.' };
  }
}

export async function resetAuthenticatedState(_accountId: string, _name: string): Promise<AppState> {
  const snapshot = await requestJson<ApiSessionSnapshot>('/api/state/reset', {
    method: 'POST',
  });
  if (!isValidAppState(snapshot.state)) {
    throw new Error('Server returned invalid app state.');
  }
  return snapshot.state;
}

export async function signUp(name: string, password: string): Promise<AuthResponse> {
  try {
    const snapshot = await requestJson<ApiSessionSnapshot>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
    if (snapshot.token) {
      writeToken(snapshot.token);
    }
    return toAuthSuccess(snapshot);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create account.' };
  }
}

export async function signIn(name: string, password: string): Promise<AuthResponse> {
  try {
    const snapshot = await requestJson<ApiSessionSnapshot>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
    if (snapshot.token) {
      writeToken(snapshot.token);
    }
    return toAuthSuccess(snapshot);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to sign in.' };
  }
}

export async function loadAuthenticatedSession(): Promise<SessionSnapshot | null> {
  if (!readToken()) {
    return null;
  }

  try {
    const snapshot = await requestJson<ApiSessionSnapshot>('/api/auth/session');
    if (!isValidAppState(snapshot.state)) {
      clearAuthenticatedSession();
      return null;
    }

    return {
      accountId: snapshot.accountId,
      accountName: snapshot.accountName,
      state: snapshot.state,
    };
  } catch {
    clearAuthenticatedSession();
    return null;
  }
}