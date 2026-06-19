import React, { useState, useEffect } from 'react';
import {
  X, LogOut, KeyRound, Trash2, Pencil, Check, ChevronLeft, Loader2, AlertTriangle, User, Star,
} from 'lucide-react';
import {
  signOut, updateProfile, updateEmail, updatePassword, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, isTestMode } from '../firebase';
import { useStore } from '../store';
import { profileImages } from '../profileImages';
import { isProtectedUsername, isExactProtectedUsername, PROTECTED_USERNAME } from '../reservedNames';
import { isProfaneUsername } from '../profanityFilter';
import Avatar from './Avatar';

const EMAIL_DOMAIN = '@ivebeensomewhere.tp';

const cleanUsername = (name) => name.trim().replace(/[^a-zA-Z0-9_]/g, '');

export default function UserSettingsModal({ isOpen, onClose }) {
  const { user, username, profileImage, updateProfileImage } = useStore();
  const displayName = username || user?.displayName || '';

  // LIMITED/ avatars are only offered to the protected owner account.
  const canUseLimited = isExactProtectedUsername(displayName);
  const availableImages = profileImages.filter((img) => !img.limited || canUseLimited);

  // Which panel is showing: the menu, or one of the focused editors.
  const [view, setView] = useState('main');

  // Shared async/feedback state for the editors.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Field state.
  const [nameInput, setNameInput] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [deletePw, setDeletePw] = useState('');

  // Reset everything whenever the modal is (re)opened or closed.
  useEffect(() => {
    if (isOpen) {
      setView('main');
      setError('');
      setNotice('');
      setNameInput(displayName);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setDeletePw('');
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const goMain = () => {
    setView('main');
    setError('');
    setNotice('');
  };

  const handleLogout = () => {
    if (!isTestMode) {
      signOut(auth).catch((err) => console.error('Logout error:', err));
    } else {
      alert('Running in test mode. Logout disabled.');
    }
    onClose();
  };

  // ---- Username change ----------------------------------------------------
  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setError('');
    const next = cleanUsername(nameInput);

    if (!next || next.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, underscores).');
      return;
    }
    if (next.toLowerCase() === displayName.toLowerCase()) {
      goMain();
      return;
    }

    // Protect the reserved handle: only its existing owner may keep the exact
    // name, and nobody may rename to a look-alike.
    const ownsProtected = isExactProtectedUsername(displayName);
    if (isProtectedUsername(next) && !(isExactProtectedUsername(next) && ownsProtected)) {
      setError('That username is reserved. Please choose another.');
      return;
    }

    // Reject profane or hateful usernames.
    if (isProfaneUsername(next)) {
      setError('That username is not allowed. Please choose another.');
      return;
    }

    if (isTestMode) {
      alert('Running in test mode. Username changes are disabled.');
      goMain();
      return;
    }

    setBusy(true);
    try {
      const nextLower = next.toLowerCase();
      const oldLower = (user.email || '').split('@')[0];

      // Reject if the name is already reserved by someone else.
      const existing = await getDoc(doc(db, 'usernames', nextLower));
      if (existing.exists() && existing.data().uid !== user.uid) {
        setError('That username is already taken. Try another one.');
        setBusy(false);
        return;
      }

      // The username doubles as the login email, so update both. Email goes
      // first: if it fails (e.g. requires recent login) nothing else changes.
      await updateEmail(user, `${nextLower}${EMAIL_DOMAIN}`);
      await updateProfile(user, { displayName: next });
      await setDoc(doc(db, 'usernames', nextLower), { uid: user.uid });
      await setDoc(doc(db, 'users', user.uid), { username: next }, { merge: true });
      if (oldLower && oldLower !== nextLower) {
        // Best-effort release of the old reservation.
        deleteDoc(doc(db, 'usernames', oldLower)).catch(() => {});
      }

      useStore.getState().setUsername(next);
      goMain();
    } catch (err) {
      console.error('Username change error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, please log out and back in, then change your username.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('That username is already taken. Try another one.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Username changes are disabled by the server configuration.');
      } else {
        setError(err.message || 'Could not change username.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Password change ----------------------------------------------------
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (newPw.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('The two new passwords do not match.');
      return;
    }

    if (isTestMode) {
      alert('Running in test mode. Password changes are disabled.');
      return;
    }

    setBusy(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setNotice('Password updated.');
    } catch (err) {
      console.error('Password change error:', err);
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Your current password is incorrect.');
      } else {
        setError(err.message || 'Could not change password.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Account deletion ---------------------------------------------------
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setError('');

    if (isTestMode) {
      alert('Running in test mode. Account deletion is disabled.');
      return;
    }

    setBusy(true);
    // Suppress the store's auth-doc listener from re-creating the user doc the
    // instant we delete it (that race left orphaned 0% leaderboard entries).
    useStore.getState().setDeletingAccount(true);
    try {
      // Re-authenticate (also serves as the confirmation) before deleting.
      const credential = EmailAuthProvider.credential(user.email, deletePw);
      await reauthenticateWithCredential(user, credential);

      const oldLower = (user.email || '').split('@')[0];
      // Clear ALL Firestore data while still authenticated: the private visited
      // subdoc, the public profile doc, and the username reservation.
      await deleteDoc(doc(db, 'users', user.uid, 'private', 'visited')).catch(() => {});
      await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
      if (oldLower) await deleteDoc(doc(db, 'usernames', oldLower)).catch(() => {});

      await deleteUser(user); // triggers onAuthStateChanged -> store cleared
      onClose();
    } catch (err) {
      console.error('Account deletion error:', err);
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect password. Account was not deleted.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('For security, please log out and back in, then delete your account.');
      } else {
        setError(err.message || 'Could not delete account.');
      }
      setBusy(false);
    } finally {
      // Safe to clear now: either the user is signed out (rules block any
      // re-create) or the deletion failed and nothing was removed.
      useStore.getState().setDeletingAccount(false);
    }
  };

  // ---- Profile image picker ----------------------------------------------
  const handlePickImage = (key) => {
    updateProfileImage(key);
    goMain();
  };

  const inputClass =
    'w-full rounded-md border-2 border-brass/40 bg-paper/30 py-2 pl-10 pr-4 font-typewriter text-sm text-ink outline-none transition-all focus:border-brass focus:bg-paper-light focus:ring-1 focus:ring-brass';

  const ErrorBox = error ? (
    <div className="mb-4 rounded-md border border-oxblood/30 bg-oxblood/5 p-3 font-typewriter text-xs text-oxblood">
      {error}
    </div>
  ) : null;

  const NoticeBox = notice ? (
    <div className="mb-4 rounded-md border border-emerald-700/30 bg-emerald-700/5 p-3 font-typewriter text-xs text-emerald-800">
      {notice}
    </div>
  ) : null;

  const BackHeader = ({ title }) => (
    <div className="mb-5 flex items-center gap-2">
      <button
        onClick={goMain}
        className="rounded-sm p-1 text-ash/70 transition-colors hover:bg-ink/5 hover:text-ink"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[0.85rem] bg-rail-gradient bg-[length:200%_auto] animate-gradient p-[3px] shadow-glow-strong animate-pop">
        <div className="overflow-hidden rounded-[0.75rem] bg-paper-light/95 p-6 text-ink">

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-sm p-1 text-ash/70 transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* ============================ MAIN MENU ============================ */}
          {view === 'main' && (
            <>
              {/* Profile header: clickable avatar + username */}
              <div className="mb-6 flex flex-col items-center">
                <button
                  onClick={() => { setView('avatar'); setError(''); setNotice(''); }}
                  className="group relative mb-2 rounded-md ring-2 ring-transparent transition-all hover:ring-brass/60 active:scale-95"
                  title="Change profile picture"
                  aria-label="Change profile picture"
                >
                  <Avatar
                    name={displayName}
                    profileImage={profileImage}
                    className="h-16 w-16 overflow-hidden rounded-md text-2xl shadow-glow"
                  />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-ink text-brass opacity-0 shadow-card transition-opacity group-hover:opacity-100">
                    <Pencil className="h-3 w-3" />
                  </span>
                </button>

                <button
                  onClick={() => { setView('username'); setNameInput(displayName); setError(''); setNotice(''); }}
                  className="group flex items-center gap-1.5 rounded-sm px-2 py-0.5 transition-colors hover:bg-ink/5"
                  title="Change username"
                >
                  <span className="font-display text-2xl font-bold uppercase tracking-wide">
                    {displayName || 'Traveler'}
                  </span>
                  <Pencil className="h-4 w-4 text-ash/50 transition-colors group-hover:text-ink" />
                </button>
                <p className="mt-1 font-typewriter text-xs text-oxblood">Account settings</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setView('password'); setError(''); setNotice(''); }}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-brass/40 bg-brass/10 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-brass/25 active:scale-95"
                >
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </button>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-ink/30 bg-ink/5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-ink/15 active:scale-95"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>

                <button
                  onClick={() => { setView('delete'); setDeletePw(''); setError(''); setNotice(''); }}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-oxblood/40 bg-oxblood/10 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-oxblood transition-all hover:bg-oxblood/35 hover:text-white active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </button>
              </div>
            </>
          )}

          {/* ============================ USERNAME ============================ */}
          {view === 'username' && (
            <>
              <BackHeader title="Change Username" />
              {ErrorBox}
              <form onSubmit={handleSaveUsername} className="space-y-4">
                <div>
                  <label className="mb-1 block font-typewriter text-xs font-semibold text-ash">
                    New username
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-ash/50" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. wanderer"
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-1 font-typewriter text-[0.7rem] text-ash/70">
                    Letters, numbers and underscores. This is also your login name.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brass-gradient py-2.5 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Save</>}
                </button>
              </form>
            </>
          )}

          {/* ============================ AVATAR PICKER ============================ */}
          {view === 'avatar' && (
            <>
              <BackHeader title="Profile Picture" />
              <p className="mb-4 font-typewriter text-xs text-ash">
                Choose a picture, or keep your monogram.
              </p>
              <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4">
                {/* Monogram option (always available) */}
                <ImageChoice
                  selected={!profileImage}
                  onClick={() => handlePickImage(null)}
                  label="Monogram"
                >
                  <Avatar
                    name={displayName}
                    profileImage={null}
                    className="h-full w-full rounded-md text-2xl"
                  />
                </ImageChoice>

                {availableImages.map((img) => (
                  <ImageChoice
                    key={img.key}
                    selected={profileImage === img.key}
                    onClick={() => handlePickImage(img.key)}
                    label={img.limited ? `${img.key} (limited)` : img.key}
                    limited={img.limited}
                  >
                    <img
                      src={img.url}
                      alt={img.key}
                      className="h-full w-full rounded-md object-cover"
                    />
                  </ImageChoice>
                ))}
              </div>
            </>
          )}

          {/* ============================ PASSWORD ============================ */}
          {view === 'password' && (
            <>
              <BackHeader title="Change Password" />
              {ErrorBox}
              {NoticeBox}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <PasswordField
                  label="Current password"
                  value={currentPw}
                  onChange={setCurrentPw}
                  inputClass={inputClass}
                  autoFocus
                />
                <PasswordField
                  label="New password"
                  value={newPw}
                  onChange={setNewPw}
                  inputClass={inputClass}
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  inputClass={inputClass}
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brass-gradient py-2.5 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Update Password</>}
                </button>
              </form>
            </>
          )}

          {/* ============================ DELETE ============================ */}
          {view === 'delete' && (
            <>
              <BackHeader title="Delete Account" />
              {ErrorBox}
              <div className="mb-4 flex gap-3 rounded-md border border-oxblood/30 bg-oxblood/5 p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-oxblood" />
                <p className="font-typewriter text-xs text-oxblood">
                  This permanently deletes your account and your travel log. This
                  cannot be undone. Enter your password to confirm.
                </p>
              </div>
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <PasswordField
                  label="Password"
                  value={deletePw}
                  onChange={setDeletePw}
                  inputClass={inputClass}
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={goMain}
                    className="flex-1 rounded-md border border-ink/30 bg-ink/5 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-ink/15 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-oxblood/50 bg-oxblood/80 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-oxblood active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" /> Delete</>}
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// A single selectable square in the profile-picture grid.
function ImageChoice({ selected, onClick, label, limited = false, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative aspect-square overflow-hidden rounded-md ring-2 transition-all active:scale-95 ${
        selected
          ? 'ring-brass shadow-glow'
          : limited
            ? 'ring-gold/60 hover:ring-gold'
            : 'ring-transparent hover:ring-brass/50'
      }`}
    >
      {children}
      {limited && (
        <span className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 bg-ink/80 py-0.5 font-display text-[0.55rem] font-bold uppercase tracking-wider text-gold">
          <Star className="h-2.5 w-2.5 fill-gold" />
          Limited
        </span>
      )}
      {selected && (
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brass text-ink shadow-card">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

// A labelled password input with the lock icon, matching the auth modal style.
function PasswordField({ label, value, onChange, inputClass, autoFocus = false }) {
  return (
    <div>
      <label className="mb-1 block font-typewriter text-xs font-semibold text-ash">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <KeyRound className="h-4 w-4 text-ash/50" />
        </div>
        <input
          type="password"
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>
    </div>
  );
}
