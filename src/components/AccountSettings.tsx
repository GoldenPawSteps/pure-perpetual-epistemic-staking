import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context';

interface Props {
  onClose: () => void;
}

type Panel = 'main' | 'change-password' | 'delete-account';

export function AccountSettings({ onClose }: Props) {
  const { currentAccountName, changeAccountPassword, deleteCurrentAccount, logout } = useAppContext();
  const [panel, setPanel] = useState<Panel>('main');

  // Change-password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Delete-account field
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    overlayRef.current
      ?.querySelector<HTMLElement>('button, input')
      ?.focus();
  }, [panel]);

  function resetPasswordPanel() {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess(false);
  }

  function resetDeletePanel() {
    setDeletePw('');
    setDeleteError('');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    setPwSubmitting(true);
    const result = await changeAccountPassword(currentPw, newPw);
    setPwSubmitting(false);
    if (!result.ok) {
      setPwError(result.error ?? 'Password change failed.');
      return;
    }
    setPwSuccess(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteSubmitting(true);
    const result = await deleteCurrentAccount(deletePw);
    setDeleteSubmitting(false);
    if (!result.ok) {
      setDeleteError(result.error ?? 'Deletion failed.');
      return;
    }
    // context already signed us out; close the modal
    onClose();
  }

  return (
    <div
      className="create-claim-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      ref={overlayRef}
    >
      <div className="create-claim-modal account-settings-modal" role="dialog" aria-modal="true" aria-label="Account settings">
        <div className="modal-header">
          {panel !== 'main' && (
            <button
              type="button"
              className="modal-back-btn"
              onClick={() => {
                setPanel('main');
                resetPasswordPanel();
                resetDeletePanel();
              }}
              aria-label="Back"
            >
              ←
            </button>
          )}
          <h2>
            {panel === 'main' && 'Account Settings'}
            {panel === 'change-password' && 'Change Password'}
            {panel === 'delete-account' && 'Delete Account'}
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {panel === 'main' && (
          <div className="account-settings-main">
            <div className="account-name-row">
              <span className="account-label">Signed in as</span>
              <span className="account-name-display">{currentAccountName}</span>
            </div>
            <div className="account-actions">
              <button
                type="button"
                className="btn-secondary account-action-btn"
                onClick={() => { setPanel('change-password'); }}
              >
                Change password
              </button>
              <button
                type="button"
                className="account-action-btn account-danger-btn"
                onClick={() => { setPanel('delete-account'); }}
              >
                Delete account
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { logout(); onClose(); }}>
                Log out
              </button>
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}

        {panel === 'change-password' && (
          <form onSubmit={e => { void handleChangePassword(e); }} className="account-settings-form">
            <div className="field">
              <label htmlFor="current-pw">Current password</label>
              <input
                id="current-pw"
                type="password"
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-pw">New password <span className="required">*</span></label>
              <input
                id="new-pw"
                type="password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-pw">Confirm new password <span className="required">*</span></label>
              <input
                id="confirm-pw"
                type="password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {pwError && <div className="form-error">{pwError}</div>}
            {pwSuccess && <div className="form-success">Password changed successfully.</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setPanel('main'); resetPasswordPanel(); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pwSubmitting}>
                {pwSubmitting ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </form>
        )}

        {panel === 'delete-account' && (
          <form onSubmit={e => { void handleDeleteAccount(e); }} className="account-settings-form">
            <div className="delete-warning">
              <strong>This will permanently delete your account and all market data.</strong> This cannot be undone.
            </div>
            <div className="field">
              <label htmlFor="delete-confirm-pw">Confirm with your password</label>
              <input
                id="delete-confirm-pw"
                type="password"
                value={deletePw}
                onChange={e => { setDeletePw(e.target.value); setDeleteError(''); }}
                autoComplete="current-password"
                required
              />
            </div>
            {deleteError && <div className="form-error">{deleteError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setPanel('main'); resetDeletePanel(); }}>
                Cancel
              </button>
              <button type="submit" className="account-delete-confirm-btn" disabled={deleteSubmitting}>
                {deleteSubmitting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
