import { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, User, X } from 'lucide-react';
import {
  changeAccountPassword,
  deleteAccountPermanent,
  updateAccountProfile,
} from '../services/api';

export default function AccountSettingsModal({
  user,
  onClose,
  onUserUpdated,
  onAccountDeleted,
  onShowToast,
}) {
  const [name, setName] = useState(() => user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateAccountProfile({ name: name.trim() });
      onUserUpdated(res.user);
      onShowToast('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!currentPassword || newPassword.length < 8) {
      setError('Enter your current password and a new password of at least 8 characters.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await changeAccountPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      onShowToast('Password changed successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    setError('');
    if (!deletePassword) {
      setError('Enter your password to confirm permanent account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccountPermanent({ password: deletePassword });
      onAccountDeleted();
    } catch (err) {
      setError(err.message || 'Account deletion failed.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-100 z-10">
          <div>
            <h3 id="account-settings-title" className="text-lg font-bold text-slate-900">
              Account Settings
            </h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          ) : null}

          {/* Profile Section */}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <User className="h-4 w-4 text-emerald-600" />
              Profile Information
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Display Name"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold shrink-0 transition-colors"
              >
                {isSavingProfile ? 'Saving...' : 'Update Name'}
              </button>
            </div>
          </form>

          <hr className="border-slate-100" />

          {/* Password Section */}
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              Change Password
            </div>
            {user.isDemo ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                Password changes are disabled on the shared Demo Explorer sandbox account.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <input
                    type="password"
                    placeholder="New password (8+ chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  {isSavingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </>
            )}
          </form>

          <hr className="border-slate-100" />

          {/* Danger Zone */}
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-red-700">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              Danger Zone — Delete Account
            </div>
            {user.isDemo ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                The shared Demo Explorer account cannot be permanently deleted.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Permanently deletes your user profile, active sessions, habits, and all streak history. This action cannot be undone.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="flex-1 rounded-xl border border-red-200 px-3.5 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                  <button
                    type="submit"
                    disabled={isDeletingAccount}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
