// passwordResetClient.js — thin client wrapper over the reset Cloud Functions.
//
// Every call here is just a messenger: it sends the user's input to the trusted
// backend and returns the backend's verdict. No grading, eligibility, attempt
// counting or password logic lives on the client — by design. In test mode the
// calls are routed to a local mock so the UI works offline.

import { httpsCallable } from 'firebase/functions';
import { functions, isTestMode } from './firebase';

async function call(name, data) {
  if (isTestMode) {
    const { mockCall } = await import('./mockResetBackend');
    return mockCall(name, data);
  }
  const fn = httpsCallable(functions, name);
  const res = await fn(data);
  return res.data;
}

// 1) Ask for (or resume) a 10-place challenge for `username`.
export const requestChallenge = (username) =>
  call('requestPasswordResetChallenge', { username });

// 2) Submit a sorted set: answers is { [placeId]: boolean been }.
export const submitChallenge = (username, sessionId, answers) =>
  call('submitPasswordResetChallenge', { username, sessionId, answers });

// 3) Set the new password using the one-time token from a passed quiz.
export const completeReset = (username, resetToken, newPassword) =>
  call('completePasswordReset', { username, resetToken, newPassword });

// 4) Clear reset/lockout state after a successful normal sign-in (requires auth).
export const clearResetStateOnLogin = () =>
  call('clearResetStateOnLogin', {});
