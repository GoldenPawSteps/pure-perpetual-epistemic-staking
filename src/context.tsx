import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import type { AppState, AppAction } from './types';
import { reducer } from './store';
import {
  changePassword,
  clearAuthenticatedSession,
  deleteAccount,
  loadAuthenticatedSession,
  resetAuthenticatedState,
  saveAuthenticatedState,
  signIn,
  signUp,
} from './auth';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AppContextValue {
  authStatus: AuthStatus;
  currentAccountId: string | null;
  currentAccountName: string | null;
  state: AppState | null;
  dispatch: React.Dispatch<AppAction>;
  login: (name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  resetAccountState: () => Promise<void>;
  changeAccountPassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCurrentAccount: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [currentAccountName, setCurrentAccountName] = useState<string | null>(null);
  const [state, dispatch] = useReducer(
    (s: AppState | null, a: AppAction): AppState | null => {
      if (a.type === 'LOAD_STATE') return a.state;
      if (!s) return s;
      return reducer(s, a);
    },
    null,
  );

  // Load persisted state on mount
  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      const session = await loadAuthenticatedSession();
      if (isCancelled) {
        return;
      }

      if (session) {
        setCurrentAccountId(session.accountId);
        setCurrentAccountName(session.accountName);
        setAuthStatus('signed-in');
        dispatch({ type: 'LOAD_STATE', state: session.state });
        return;
      }

      setAuthStatus('signed-out');
    }

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Persist state changes
  const prevStateRef = useRef<AppState | null>(null);
  useEffect(() => {
    if (state && currentAccountId && state !== prevStateRef.current) {
      prevStateRef.current = state;
      void saveAuthenticatedState(currentAccountId, state);
    }
  }, [currentAccountId, state]);

  async function login(name: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const result = await signIn(name, password);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    prevStateRef.current = result.state;
    setCurrentAccountId(result.accountId);
    setCurrentAccountName(result.accountName);
    setAuthStatus('signed-in');
    dispatch({ type: 'LOAD_STATE', state: result.state });
    return { ok: true };
  }

  async function register(name: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const result = await signUp(name, password);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    prevStateRef.current = result.state;
    setCurrentAccountId(result.accountId);
    setCurrentAccountName(result.accountName);
    setAuthStatus('signed-in');
    dispatch({ type: 'LOAD_STATE', state: result.state });
    return { ok: true };
  }

  function logout() {
    prevStateRef.current = null;
    clearAuthenticatedSession();
    setCurrentAccountId(null);
    setCurrentAccountName(null);
    setAuthStatus('signed-out');
    dispatch({ type: 'LOAD_STATE', state: null });
  }

  async function resetAccountState() {
    if (!currentAccountId || !currentAccountName) {
      return;
    }

    const nextState = await resetAuthenticatedState(currentAccountId, currentAccountName);
    prevStateRef.current = nextState;
    dispatch({ type: 'LOAD_STATE', state: nextState });
  }

  async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    return changePassword(currentPassword, newPassword);
  }

  async function deleteCurrentAccount(password: string): Promise<{ ok: boolean; error?: string }> {
    const result = await deleteAccount(password);
    if (result.ok) {
      prevStateRef.current = null;
      setCurrentAccountId(null);
      setCurrentAccountName(null);
      setAuthStatus('signed-out');
      dispatch({ type: 'LOAD_STATE', state: null });
    }
    return result;
  }

  return (
    <AppContext.Provider
      value={{
        authStatus,
        currentAccountId,
        currentAccountName,
        state,
        dispatch,
        login,
        register,
        logout,
        resetAccountState,
        changeAccountPassword,
        deleteCurrentAccount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Context files intentionally export both providers and hooks
// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
}
