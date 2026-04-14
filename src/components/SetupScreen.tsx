import React, { useState } from 'react';
import { useAppContext } from '../context';

type SetupMode = 'auth' | 'loading';

interface Props {
  mode?: SetupMode;
}

export function SetupScreen({ mode = 'auth' }: Props) {
  const { login, register } = useAppContext();
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (mode === 'loading') {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="setup-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="23" stroke="var(--accent)" strokeWidth="2"/>
              <path d="M12 24 Q24 8 36 24 Q24 40 12 24Z" fill="var(--accent)" opacity="0.15"/>
              <path d="M12 24 Q24 8 36 24" stroke="var(--yes-color)" strokeWidth="2" fill="none"/>
              <path d="M12 24 Q24 40 36 24" stroke="var(--no-color)" strokeWidth="2" fill="none"/>
              <circle cx="24" cy="24" r="3" fill="var(--accent)"/>
            </svg>
          </div>
          <h1 className="setup-title">Restoring your market session</h1>
          <p className="setup-subtitle">Loading account data from local storage.</p>
        </div>
      </div>
    );
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (authMode === 'sign-up' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = authMode === 'sign-up'
      ? await register(trimmed, password)
      : await login(trimmed, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? 'Authentication failed.');
      return;
    }

    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="23" stroke="var(--accent)" strokeWidth="2"/>
            <path d="M12 24 Q24 8 36 24 Q24 40 12 24Z" fill="var(--accent)" opacity="0.15"/>
            <path d="M12 24 Q24 8 36 24" stroke="var(--yes-color)" strokeWidth="2" fill="none"/>
            <path d="M12 24 Q24 40 36 24" stroke="var(--no-color)" strokeWidth="2" fill="none"/>
            <circle cx="24" cy="24" r="3" fill="var(--accent)"/>
          </svg>
        </div>
        <h1 className="setup-title">Pure Perpetual Epistemic Staking</h1>
        <p className="setup-subtitle">
          Create an account or sign back in. Claims are shared across all users; each account tracks its own balance and positions.
        </p>
        <div className="setup-formula">
          C(y,n) = log₂(2ʸ + 2ⁿ) − 1
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-tab ${authMode === 'sign-up' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('sign-up');
              setError('');
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`auth-tab ${authMode === 'sign-in' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('sign-in');
              setError('');
            }}
          >
            Sign in
          </button>
        </div>
        <form onSubmit={handleStart} className="setup-form">
          <input
            type="text"
            aria-label="Your name"
            placeholder="Choose a username"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            autoFocus
            maxLength={50}
          />
          <input
            type="password"
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            minLength={8}
            maxLength={100}
          />
          {authMode === 'sign-up' && (
            <input
              type="password"
              aria-label="Confirm password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              minLength={8}
              maxLength={100}
            />
          )}
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary setup-btn" disabled={isSubmitting}>
            {isSubmitting
              ? 'Working...'
              : authMode === 'sign-up'
                ? 'Create account with 1.0 units →'
                : 'Sign in →'}
          </button>
        </form>
        <div className="setup-rules">
          <div className="rule">Every account starts with <strong>1 unit</strong></div>
          <div className="rule">Passwords are <strong>hashed server-side</strong></div>
          <div className="rule">Stakes are <strong>perpetual</strong></div>
          <div className="rule">Prices represent <strong>belief strength</strong></div>
          <div className="rule">Session restore is <strong>automatic</strong></div>
        </div>
      </div>
    </div>
  );
}
