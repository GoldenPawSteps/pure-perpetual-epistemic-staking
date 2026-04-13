import React, { useState } from 'react';
import { useAppContext, createInitialState } from '../context';

export function SetupScreen() {
  const { dispatch } = useAppContext();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a name to begin.');
      return;
    }
    const initialState = createInitialState(trimmed);
    dispatch({ type: 'LOAD_STATE', state: initialState });
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
          A perpetual belief market. No oracle. No resolution. Only collective epistemic weight.
        </p>
        <div className="setup-formula">
          C(y,n) = log₂(2ʸ + 2ⁿ) − 1
        </div>
        <form onSubmit={handleStart} className="setup-form">
          <input
            type="text"
            aria-label="Your name"
            placeholder="Enter your name to begin"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            autoFocus
            maxLength={50}
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary setup-btn">
            Start with 1.0 units →
          </button>
        </form>
        <div className="setup-rules">
          <div className="rule">Every user starts with <strong>1 unit</strong></div>
          <div className="rule">Stakes are <strong>perpetual</strong></div>
          <div className="rule">Prices represent <strong>belief strength</strong></div>
          <div className="rule">System is <strong>zero-sum</strong> relative to cost function</div>
        </div>
      </div>
    </div>
  );
}
