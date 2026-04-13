import React, { useState } from 'react';
import { useAppContext } from '../context';

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function CreateClaimForm({ onCreated, onCancel }: Props) {
  const { state, dispatch } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!state) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const id = generateId();
    dispatch({ type: 'CREATE_CLAIM', id, title, description });
    setError('');
    onCreated(id);
  }

  return (
    <div className="create-claim-overlay" onClick={onCancel}>
      <div className="create-claim-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Claim</h2>
          <button className="close-btn" onClick={onCancel} type="button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="claim-title">Title <span className="required">*</span></label>
            <input
              id="claim-title"
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              placeholder="A clear, falsifiable claim…"
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="field">
            <label htmlFor="claim-desc">Description</label>
            <textarea
              id="claim-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional clarification or context…"
              rows={3}
              maxLength={1000}
            />
          </div>
          <p className="create-note">
            New claims start at 50% YES / 50% NO. No resolution mechanism — prices reflect collective belief only.
          </p>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Claim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
