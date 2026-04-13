import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { AppState, AppAction } from './types';
import { reducer, loadFromStorage, saveToStorage, createInitialState } from './store';

interface AppContextValue {
  state: AppState | null;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
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
    const saved = loadFromStorage();
    if (saved) {
      dispatch({ type: 'LOAD_STATE', state: saved });
    }
  }, []);

  // Persist state changes
  const prevStateRef = useRef<AppState | null>(null);
  useEffect(() => {
    if (state && state !== prevStateRef.current) {
      prevStateRef.current = state;
      saveToStorage(state);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
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

// eslint-disable-next-line react-refresh/only-export-components
export { createInitialState };
