import React from 'react';
import { X, UserCog, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, isTestMode } from '../firebase';
import { useStore } from '../store';

export default function UserSettingsModal({ isOpen, onClose }) {
  const { user } = useStore();

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLogout = () => {
    if (!isTestMode) {
      signOut(auth).catch(err => console.error("Logout error:", err));
    } else {
      alert("Running in test mode. Logout disabled.");
    }
    onClose();
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
            className="absolute right-4 top-4 rounded-sm p-1 text-ash/70 hover:bg-ink/5 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon Header */}
          <div className="mb-6 flex flex-col items-center">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brass-gradient text-ink shadow-glow mb-2">
              <UserCog className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
              Settings
            </h2>
            {user?.displayName && (
              <p className="font-typewriter text-xs text-oxblood mt-1">
                Signed in as {user.displayName}
              </p>
            )}
          </div>

          {/* Log Out */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-oxblood/40 bg-oxblood/10 py-2.5 font-display text-sm font-semibold uppercase tracking-wider text-oxblood transition-all hover:bg-oxblood/35 hover:text-white active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>

        </div>
      </div>
    </div>
  );
}
