// Cloud Functions entry point — ONLY the onCall wrappers live here.
//
// The firebase-functions deploy analyzer recurses into every export of this
// file, so it must export nothing but CloudFunction objects. All the actual
// logic (and the Firestore/Auth instances) lives in ./src/handlers.js.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  processRequestChallenge,
  processSubmitChallenge,
  processCompleteReset,
  processClearResetState,
} from './src/handlers.js';

// App Check (when enabled) blocks calls that don't originate from the real web
// app. Toggled by ENFORCE_APP_CHECK (true in functions/.env for production,
// false in functions/.env.local so the emulator works). The hard per-uid attempt
// cap is the primary control regardless.
const CALL_OPTS = { enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true', cors: true };

export const requestPasswordResetChallenge = onCall(CALL_OPTS, (request) =>
  processRequestChallenge(request.data));

export const submitPasswordResetChallenge = onCall(CALL_OPTS, (request) =>
  processSubmitChallenge(request.data));

export const completePasswordReset = onCall(CALL_OPTS, (request) =>
  processCompleteReset(request.data));

export const clearResetStateOnLogin = onCall(CALL_OPTS, (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  return processClearResetState(request.auth.uid);
});
