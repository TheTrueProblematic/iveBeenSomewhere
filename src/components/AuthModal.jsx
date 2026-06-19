import React, { useState, useEffect } from 'react';
import { X, Lock, User, KeyRound, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, isTestMode } from '../firebase';
import { useStore } from '../store';
import { isProtectedUsername } from '../reservedNames';
import { isProfaneUsername } from '../profanityFilter';
import PasswordResetFlow from './PasswordResetFlow';

// Wrong passwords are tolerated this many times before the user is pushed into
// the identity-proof reset flow. (This is a UX nudge — true brute-force defense
// is Firebase Auth's own server-side throttling, which we can't bypass anyway.)
const MAX_PASSWORD_ATTEMPTS = 5;

export default function AuthModal({ isOpen, onClose, places = [] }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 'auth' = the sign-in / sign-up form; 'reset' = the password-reset flow.
  const [mode, setMode] = useState('auth');
  const [failCount, setFailCount] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const { setUser } = useStore();

  // Fresh start each time the modal opens — including clearing the typed
  // credentials so a previous session's username/password never lingers.
  useEffect(() => {
    if (isOpen) {
      setMode('auth');
      setIsSignUp(false);
      setUsername('');
      setPassword('');
      setError('');
      setLoading(false);
      setFailCount(0);
      setShowForgot(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const cleanUsername = (name) => {
    return name.trim().replace(/[^a-zA-Z0-9_]/g, '');
  };

  // Any failed sign-in reveals "Forgot Password?", and past the limit switches
  // straight into the reset flow. We deliberately don't pre-check that the
  // account exists here — that's decided server-side when a reset is actually
  // attempted (usernames are already public, so this reveals nothing), and it
  // keeps the link from being suppressed by a transient client read error.
  const handleLoginFailure = (err) => {
    const next = failCount + 1;
    setFailCount(next);
    setShowForgot(true);
    if (next >= MAX_PASSWORD_ATTEMPTS) {
      setError('');
      setMode('reset');
      return;
    }
    setError(
      err?.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please wait a moment, or reset your password.'
        : 'Incorrect username or password.',
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formattedUsername = cleanUsername(username);
    if (!formattedUsername || formattedUsername.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, underscores).');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    // Block sign-ups that impersonate the reserved handle (or look-alikes).
    if (isSignUp && isProtectedUsername(formattedUsername)) {
      setError('That username is reserved. Please choose another.');
      setLoading(false);
      return;
    }

    // Block sign-ups with profane or hateful usernames.
    if (isSignUp && isProfaneUsername(formattedUsername)) {
      setError('That username is not allowed. Please choose another.');
      setLoading(false);
      return;
    }

    const virtualEmail = `${formattedUsername.toLowerCase()}@ivebeensomewhere.tp`;

    // Test-mode shortcut so the flows can be demoed offline. Password "letmein"
    // signs in; anything else simulates a wrong password on a valid account.
    if (isTestMode && !isSignUp) {
      if (password === 'letmein') {
        setUser(auth.currentUser);
        onClose();
      } else {
        handleLoginFailure();
      }
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Check if username is already taken in Firestore
        const usernameDocRef = doc(db, 'usernames', formattedUsername.toLowerCase());
        const usernameDoc = await getDoc(usernameDocRef);

        if (usernameDoc.exists()) {
          setError('That username is already taken. Try another one.');
          setLoading(false);
          return;
        }

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, virtualEmail, password);
        const user = userCredential.user;

        // Set display name
        await updateProfile(user, { displayName: formattedUsername });

        // Reserve the username and initialize the user docs. The visited LIST
        // lives in the owner-only private doc; the public doc keeps only the
        // leaderboard count.
        await setDoc(doc(db, 'usernames', formattedUsername.toLowerCase()), {
          uid: user.uid
        });
        await setDoc(doc(db, 'users', user.uid), {
          username: formattedUsername,
          visitedCount: 0
        });
        await setDoc(doc(db, 'users', user.uid, 'private', 'visited'), {
          visitedPlaces: []
        });

        setUser(user);
        onClose();
      } else {
        // Log in
        const userCredential = await signInWithEmailAndPassword(auth, virtualEmail, password);
        setUser(userCredential.user);
        // A successful real sign-in is the "until they sign in successfully"
        // unlock: clear any reset lockout and restore the leaderboard entry.
        // Both are writes this (now-authenticated) user is allowed to make
        // directly — deleting their own resetSessions doc resets the lock and
        // the attempt budget — so the unlock needs no Cloud Function in the path.
        const uid = userCredential.user.uid;
        try {
          await deleteDoc(doc(db, 'resetSessions', uid));
        } catch (err) {
          console.error('Could not clear reset lock on login:', err);
        }
        try {
          await setDoc(doc(db, 'users', uid), { leaderboardHidden: false }, { merge: true });
        } catch (_) { /* ignore */ }
        onClose();
      }
    } catch (err) {
      console.error(err);
      if (!isSignUp) {
        // Any sign-in failure offers the reset path (see handleLoginFailure).
        handleLoginFailure(err);
      } else if (err.code === 'auth/email-already-in-use') {
        setError('A user with that name already exists.');
      } else if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Incorrect username or password.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

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
            className="absolute right-4 top-4 z-10 rounded-sm p-1 text-ash/70 hover:bg-ink/5 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {mode === 'reset' ? (
            <PasswordResetFlow
              places={places}
              initialUsername={cleanUsername(username)}
              onBack={() => { setMode('auth'); setError(''); }}
              onResetComplete={() => {
                setMode('auth');
                setIsSignUp(false);
                setPassword('');
                setFailCount(0);
                setShowForgot(false);
                setError('');
              }}
            />
          ) : (
            <>
              {/* Icon Header */}
              <div className="mb-6 flex flex-col items-center">
                <div className="grid h-12 w-12 place-items-center rounded-md bg-brass-gradient text-ink shadow-glow mb-2">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                  {isSignUp ? 'Join the Trail' : 'Sign In'}
                </h2>
                <p className="font-typewriter text-xs text-oxblood mt-1">
                  {isSignUp ? 'Claim your travel logbook' : 'Pick up where you left off'}
                </p>
              </div>

              {/* Tabs */}
              <div className="mb-6 grid grid-cols-2 gap-2 border-b border-ink/10 pb-3 font-display">
                <button
                  onClick={() => { setIsSignUp(false); setError(''); }}
                  className={`pb-1 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                    !isSignUp ? 'border-b-2 border-brass text-ink font-bold' : 'text-ash/60 hover:text-ink'
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => { setIsSignUp(true); setError(''); setShowForgot(false); }}
                  className={`pb-1 text-center text-sm font-semibold uppercase tracking-wider transition-colors ${
                    isSignUp ? 'border-b-2 border-brass text-ink font-bold' : 'text-ash/60 hover:text-ink'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-oxblood/30 bg-oxblood/5 p-3 font-typewriter text-xs text-oxblood">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-typewriter text-xs font-semibold text-ash mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-ash/50" />
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={64}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. wanderer"
                      className="w-full rounded-md border-2 border-brass/40 bg-paper/30 py-2 pl-10 pr-4 font-typewriter text-sm text-ink outline-none transition-all focus:border-brass focus:bg-paper-light focus:ring-1 focus:ring-brass"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-typewriter text-xs font-semibold text-ash mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-ash/50" />
                    </div>
                    <input
                      type="password"
                      required
                      maxLength={1024}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-md border-2 border-brass/40 bg-paper/30 py-2 pl-10 pr-4 font-typewriter text-sm text-ink outline-none transition-all focus:border-brass focus:bg-paper-light focus:ring-1 focus:ring-brass"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brass-gradient py-2.5 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  )}
                </button>
              </form>

              {/* Calm reveal: only after a wrong password on a real account. */}
              {!isSignUp && showForgot && (
                <div className="mt-4 flex flex-col items-center gap-1 animate-fade-in-up">
                  <div className="h-px w-12 bg-ink/10" />
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); }}
                    className="font-typewriter text-xs text-oxblood underline-offset-4 transition-colors hover:text-brick hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
