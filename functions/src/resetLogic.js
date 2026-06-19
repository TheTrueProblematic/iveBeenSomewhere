// resetLogic.js — pure, dependency-free logic for the password-reset identity quiz.
//
// This module is the SINGLE SOURCE OF TRUTH for every security-relevant decision
// in the reset flow: who is eligible, how a challenge set is composed, and whether
// a submission is correct. It deliberately has NO Firebase / network / crypto
// imports so it can be unit-tested in isolation (see localTests/passwordReset/)
// and reused verbatim by the Cloud Functions and the test-mode mock.
//
// Security note: the *answer key* this module produces never leaves the server.
// The Cloud Functions hand the client only the list of place ids to sort; grading
// happens here, server-side. Nothing in this file is secret on its own — the
// secret is the per-user visited list it is fed, which lives behind Firestore
// rules and is read only with the Admin SDK.

// ---- Constants ------------------------------------------------------------
export const TOTAL_PLACES = 91; // the 91 locations in "I've Been Everywhere"
export const QUIZ_SIZE = 10; // tiles shown per attempt
export const MAX_ATTEMPTS = 3; // tries per reset cycle before lockout
export const MIN_ELIGIBLE = 5; // fewer than this → cannot verify identity
export const MAX_ELIGIBLE = 86; // more than this → cannot verify identity
export const MIN_PASSWORD = 6; // Firebase Auth's own minimum
export const MAX_PASSWORD = 1024; // guard against overflow / abuse
export const MAX_USERNAME = 64; // guard against overflow / abuse

// ---- Eligibility ----------------------------------------------------------
// A user can only be challenged when their visited count sits in a "middle" band:
// too few places and the quiz is trivially guessable / not distinctive; too many
// and there aren't enough unvisited places to build a meaningful test. Returns a
// stable string the caller can branch on (and map to a *generic* client message
// so the exact count never leaks).
export function eligibility(count) {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return 'invalid';
  }
  if (count < MIN_ELIGIBLE) return 'too_few';
  if (count > MAX_ELIGIBLE) return 'too_many';
  return 'eligible';
}

export function isEligible(count) {
  return eligibility(count) === 'eligible';
}

// ---- Challenge composition ------------------------------------------------
// How many of the 10 tiles should be places the user HAS been to, given their
// total visited count. The rest are places they have NOT been to. Bands:
//   5–10  → 2 visited / 8 unvisited
//   11–79 → 3–7 visited (random) / the rest unvisited
//   80–86 → 8 visited / 2 unvisited
// `rng` is injectable so tests are deterministic.
export function visitedTileCount(count, rng = Math.random) {
  if (count <= 10) return 2;
  if (count >= 80) return 8;
  // 11–79: pick a random k in [3, 7] inclusive.
  return 3 + Math.floor(rng() * 5);
}

// Fisher–Yates shuffle (returns a new array; does not mutate input).
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick `n` distinct random elements from `arr`.
export function sampleN(arr, n, rng = Math.random) {
  if (n >= arr.length) return shuffle(arr, rng);
  return shuffle(arr, rng).slice(0, n);
}

// Build one challenge set.
//   visitedIds : the user's TRUE visited place ids (from the private doc)
//   allIds     : every place id (length TOTAL_PLACES)
//   rng        : injectable randomness
// Returns { placeIds: string[10] (shuffled), answerKey: { id -> boolean been } }.
// Throws if the user is not eligible or the data can't support a valid set.
export function buildChallenge(visitedIds, allIds, rng = Math.random) {
  const visitedSet = new Set(visitedIds);
  const count = visitedSet.size;
  if (!isEligible(count)) {
    throw new Error(`not eligible (count=${count})`);
  }

  const unvisitedIds = allIds.filter((id) => !visitedSet.has(id));
  const nVisited = visitedTileCount(count, rng);
  const nUnvisited = QUIZ_SIZE - nVisited;

  // Defensive feasibility check (should always hold for an eligible user given 91
  // total places, but never trust the data blindly).
  if (nVisited > visitedSet.size || nUnvisited > unvisitedIds.length) {
    throw new Error('cannot compose a valid challenge from this data');
  }

  const chosenVisited = sampleN([...visitedSet], nVisited, rng);
  const chosenUnvisited = sampleN(unvisitedIds, nUnvisited, rng);

  const answerKey = {};
  for (const id of chosenVisited) answerKey[id] = true;
  for (const id of chosenUnvisited) answerKey[id] = false;

  // Shuffle so the two groups aren't presented in a guessable order.
  const placeIds = shuffle([...chosenVisited, ...chosenUnvisited], rng);
  return { placeIds, answerKey };
}

// ---- Grading --------------------------------------------------------------
// All-or-nothing: every one of the 10 tiles must be sorted correctly. The
// submission must cover exactly the challenge's ids (no missing, no extra) and
// every value must be a boolean matching the key.
export function gradeAnswers(answerKey, submitted) {
  if (!answerKey || typeof answerKey !== 'object') return false;
  if (!submitted || typeof submitted !== 'object') return false;

  const keyIds = Object.keys(answerKey);
  const subIds = Object.keys(submitted);
  if (keyIds.length !== QUIZ_SIZE || subIds.length !== keyIds.length) return false;

  for (const id of keyIds) {
    const v = submitted[id];
    if (typeof v !== 'boolean') return false;
    if (v !== answerKey[id]) return false;
  }
  return true;
}

// ---- Input validation (overflow / injection defense) ----------------------
// Usernames: same charset the app already enforces (letters, numbers, _), with a
// hard length cap. Returns { ok, cleaned, reason }.
export function validateUsername(name) {
  if (typeof name !== 'string') return { ok: false, reason: 'type' };
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_USERNAME) {
    return { ok: false, reason: 'length' };
  }
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_]/g, '');
  if (cleaned.length < 3) return { ok: false, reason: 'too_short' };
  return { ok: true, cleaned: cleaned.toLowerCase() };
}

// New password: string within Firebase's minimum and a sane maximum.
export function validateNewPassword(pw) {
  if (typeof pw !== 'string') return { ok: false, reason: 'type' };
  if (pw.length < MIN_PASSWORD) return { ok: false, reason: 'too_short' };
  if (pw.length > MAX_PASSWORD) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

// Submitted answers must be a plain object whose keys are EXACTLY the expected
// challenge ids and whose values are booleans. Rejects oversized / malformed
// payloads before they reach grading.
export function validateAnswers(submitted, expectedIds) {
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)) {
    return false;
  }
  const subIds = Object.keys(submitted);
  if (subIds.length !== expectedIds.length) return false;
  const expected = new Set(expectedIds);
  for (const id of subIds) {
    if (!expected.has(id)) return false;
    if (typeof submitted[id] !== 'boolean') return false;
  }
  return true;
}
