// handlers.js — the trusted backend logic for the password-reset identity quiz.
//
// SECURITY MODEL (read this first):
//   * The browser is treated as hostile. It only ever receives a list of place
//     names to sort; it never receives the answer key, the user's visited list,
//     attempt counts, or anything else secret.
//   * Every gate is enforced HERE, server-side: eligibility, grading, the 3-try
//     budget, the lockout, and the actual password write (Admin SDK).
//   * Secret state lives in `resetSessions/{uid}`, which Firestore rules make
//     unreadable/unwritable by any client (Admin SDK bypasses rules).
//   * The password can only be changed by presenting a one-time `resetToken`
//     this backend issues ONLY after a fully-correct quiz submission.
//
// The decision logic is pure (./resetSession.js + ./resetLogic.js); this file is
// the Firestore/Admin adapter. It lives separately from index.js so that index.js
// exports ONLY the CloudFunction wrappers — the firebase-functions deploy analyzer
// recurses into every export, and the Firestore/Auth instances exported here would
// blow its stack. The emulator integration test imports directly from this file.

import { HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { validateUsername, eligibility } from './resetLogic.js';
import { startChallenge, submitChallenge, completeReset } from './resetSession.js';

initializeApp();
const db = getFirestore();
const auth = getAuth();

// ---- Static place data (slim: id/name/type/desc, no GeoJSON) ---------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLACES = JSON.parse(readFileSync(join(__dirname, '..', 'places.slim.json'), 'utf8'));
const PLACE_BY_ID = new Map(PLACES.map((p) => [String(p.id), p]));
const ALL_IDS = PLACES.map((p) => String(p.id));

// ---- Effects injected into the pure state machine --------------------------
const deps = {
  rng: Math.random,
  randomId: () => randomBytes(16).toString('hex'),
  randomToken: () => randomBytes(32).toString('hex'),
  hash: (s) => createHash('sha256').update(String(s)).digest('hex'),
  now: () => Date.now(),
};

// ---- Helpers ---------------------------------------------------------------
// Turn ordered ids into client-safe tiles. NEVER includes visited status.
function hydrate(placeIds) {
  return (placeIds || []).map((id) => {
    const p = PLACE_BY_ID.get(String(id)) || { name: String(id), type: '', desc: '' };
    return { id: String(id), name: p.name, type: p.type, desc: p.desc };
  });
}

// If a state-machine response carries raw placeIds, swap them for hydrated tiles.
function finalize(response) {
  if (response && Array.isArray(response.placeIds)) {
    const { placeIds, ...rest } = response;
    return { ...rest, places: hydrate(placeIds) };
  }
  return response;
}

// Resolve a (validated) username to its uid. Username existence is already public
// via the `usernames` collection, so this leaks nothing new.
async function resolveUid(rawUsername) {
  const v = validateUsername(rawUsername);
  if (!v.ok) return null;
  const snap = await db.doc(`usernames/${v.cleaned}`).get();
  return snap.exists ? { uid: snap.data().uid, username: v.cleaned } : null;
}

// The user's TRUE visited ids (strings). Prefers the private doc; falls back to a
// legacy public field for un-migrated users.
async function readVisitedIds(uid) {
  const priv = await db.doc(`users/${uid}/private/visited`).get();
  if (priv.exists && Array.isArray(priv.data().visitedPlaces)) {
    return priv.data().visitedPlaces.map(String);
  }
  const pub = await db.doc(`users/${uid}`).get();
  if (pub.exists && Array.isArray(pub.data().visitedPlaces)) {
    return pub.data().visitedPlaces.map(String);
  }
  return [];
}

async function loadSession(uid) {
  const snap = await db.doc(`resetSessions/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function saveSession(uid, username, session) {
  // FULL OVERWRITE (no merge). The pure state machine returns the complete
  // session every time, so we replace the whole doc. Using { merge: true } here
  // is a trap: Firestore recursively merges nested MAPS, so `pending.answerKey`
  // would accumulate keys from every past challenge — bloating it past 10 and
  // making `gradeAnswers` reject every submission. Replace, don't merge.
  await db.doc(`resetSessions/${uid}`).set({
    ...session,
    uid,
    username,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// =====================================================================
// 1) Request a challenge (or resume the pending one — no reshuffle on reload).
// =====================================================================
export async function processRequestChallenge(data) {
  const resolved = await resolveUid(data?.username);
  if (!resolved) return { status: 'unavailable' }; // uniform, no enumeration aid
  const { uid, username } = resolved;

  const session = await loadSession(uid);
  const visitedIds = await readVisitedIds(uid);
  const { response, session: next } = startChallenge(session, visitedIds, ALL_IDS, deps);

  if (next !== session) await saveSession(uid, username, next);
  return finalize(response);
}

// =====================================================================
// 2) Submit a sorted set. All-or-nothing grading, server-side.
// =====================================================================
export async function processSubmitChallenge(data) {
  const resolved = await resolveUid(data?.username);
  if (!resolved) throw new HttpsError('failed-precondition', 'No active challenge.');
  const { uid, username } = resolved;

  const session = await loadSession(uid);
  const visitedIds = await readVisitedIds(uid);
  const result = submitChallenge(session, data, visitedIds, ALL_IDS, deps);

  if (result.error) {
    const map = {
      no_challenge: ['failed-precondition', 'No active challenge.'],
      stale_session: ['failed-precondition', 'Stale or invalid session.'],
      malformed: ['invalid-argument', 'Malformed answers.'],
    };
    const [code, msg] = map[result.error] || ['internal', 'Error.'];
    throw new HttpsError(code, msg);
  }

  if (result.session !== session) await saveSession(uid, username, result.session);
  if (result.hideFromLeaderboard) {
    await db.doc(`users/${uid}`).set({ leaderboardHidden: true }, { merge: true });
  }
  return finalize(result.response);
}

// =====================================================================
// 3) Complete the reset: requires the one-time token from a passed quiz.
// =====================================================================
export async function processCompleteReset(data) {
  const resolved = await resolveUid(data?.username);
  if (!resolved) throw new HttpsError('failed-precondition', 'No reset in progress.');
  const { uid, username } = resolved;

  const session = await loadSession(uid);
  const result = completeReset(session, data, deps);

  if (result.error) {
    // Persist any session change (e.g. clearing an expired token) before failing.
    if (result.session && result.session !== session) await saveSession(uid, username, result.session);
    const map = {
      bad_password: ['invalid-argument', 'Password must be 6–1024 characters.'],
      no_reset: ['failed-precondition', 'No reset in progress.'],
      expired: ['deadline-exceeded', 'Reset window expired. Start over.'],
      bad_token: ['permission-denied', 'Invalid reset token.'],
    };
    const [code, msg] = map[result.error] || ['internal', 'Error.'];
    throw new HttpsError(code, msg);
  }

  // Identity proven + token valid → set the new password with the Admin SDK.
  await auth.updateUser(uid, { password: data.newPassword });
  await saveSession(uid, username, result.session);
  if (result.unhide) {
    await db.doc(`users/${uid}`).set({ leaderboardHidden: false }, { merge: true });
  }
  return result.response;
}

// =====================================================================
// 4) Clear reset state after a successful normal sign-in.
// =====================================================================
export async function processClearResetState(uid) {
  await db.doc(`resetSessions/${uid}`).delete().catch(() => {});
  await db.doc(`users/${uid}`).set({ leaderboardHidden: false }, { merge: true });
  return { status: 'ok' };
}

// Exported for the emulator integration test.
export { db, auth, eligibility };
