// resetSession.js — the password-reset state machine as PURE functions.
//
// This holds the full server-side flow (eligibility gate → challenge → grading →
// attempt budget → lockout → one-time token → password write authorization) with
// NO Firebase/network/crypto dependencies. index.js is a thin adapter that reads
// the session from Firestore, calls these, persists the returned session, and
// carries out the side effects (set password, hide/restore leaderboard entry).
//
// Keeping this pure means the attack-vector tests exercise the EXACT logic that
// ships — there is no separate "test double" of the rules to drift out of sync.
//
// Effects are injected via `deps`:
//   { rng, randomId, randomToken, hash, now }
// Session shape (all server-side, never sent to the client):
//   { attemptNumber, lockedUntilLogin,
//     pending: { sessionId, placeIds, answerKey, createdAt } | null,
//     resetToken: { hash, expiresAt } | null }

import {
  buildChallenge,
  gradeAnswers,
  eligibility,
  validateAnswers,
  validateNewPassword,
  MAX_ATTEMPTS,
} from './resetLogic.js';

export const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

const emptySession = () => ({
  attemptNumber: 0,
  lockedUntilLogin: false,
  pending: null,
  resetToken: null,
});

// --- 1) Request (or resume) a challenge ------------------------------------
export function startChallenge(session, visitedIds, allIds, deps) {
  const s = session || emptySession();

  if (s.lockedUntilLogin) return { response: { status: 'locked' }, session: s };
  if (eligibility(visitedIds.length) !== 'eligible') {
    return { response: { status: 'ineligible' }, session: s };
  }

  const attemptNumber = s.attemptNumber || 0;
  if (MAX_ATTEMPTS - attemptNumber <= 0) {
    return { response: { status: 'locked' }, session: s };
  }

  // Resume the pending challenge so a reload can't reshuffle into an easier set.
  if (s.pending?.placeIds) {
    return {
      response: {
        status: 'challenge',
        sessionId: s.pending.sessionId,
        placeIds: s.pending.placeIds,
        attemptsRemaining: MAX_ATTEMPTS - attemptNumber,
      },
      session: s,
    };
  }

  const { placeIds, answerKey } = buildChallenge(visitedIds, allIds, deps.rng);
  const sessionId = deps.randomId();
  const next = {
    ...s,
    attemptNumber,
    lockedUntilLogin: false,
    pending: { sessionId, placeIds, answerKey, createdAt: deps.now() },
    resetToken: null,
  };
  return {
    response: {
      status: 'challenge',
      sessionId,
      placeIds,
      attemptsRemaining: MAX_ATTEMPTS - attemptNumber,
    },
    session: next,
  };
}

// --- 2) Submit a sorted set ------------------------------------------------
export function submitChallenge(session, data, visitedIds, allIds, deps) {
  const s = session || emptySession();

  if (s.lockedUntilLogin) return { response: { status: 'failed_locked' }, session: s };
  if (!s.pending?.placeIds) return { error: 'no_challenge', session: s };

  // Bind the submission to the exact pending challenge instance (blocks replay /
  // forged or stale session ids).
  if (!data || data.sessionId !== s.pending.sessionId) {
    return { error: 'stale_session', session: s };
  }

  const expectedIds = s.pending.placeIds.map(String);
  if (!validateAnswers(data.answers, expectedIds)) {
    return { error: 'malformed', session: s };
  }

  const correct = gradeAnswers(s.pending.answerKey, data.answers);

  if (correct) {
    const token = deps.randomToken();
    const next = {
      ...s,
      pending: null,
      resetToken: { hash: deps.hash(token), expiresAt: deps.now() + TOKEN_TTL_MS },
    };
    return { response: { status: 'passed', resetToken: token }, session: next };
  }

  const attemptNumber = (s.attemptNumber || 0) + 1;
  if (attemptNumber >= MAX_ATTEMPTS) {
    const next = {
      ...s,
      pending: null,
      resetToken: null,
      attemptNumber,
      lockedUntilLogin: true,
    };
    // The adapter should hide them from the leaderboard until a real sign-in.
    return { response: { status: 'failed_locked' }, session: next, hideFromLeaderboard: true };
  }

  // Tries left → brand-new random set for the next attempt.
  const { placeIds, answerKey } = buildChallenge(visitedIds, allIds, deps.rng);
  const sessionId = deps.randomId();
  const next = {
    ...s,
    attemptNumber,
    pending: { sessionId, placeIds, answerKey, createdAt: deps.now() },
    resetToken: null,
  };
  return {
    response: {
      status: 'failed',
      attemptsRemaining: MAX_ATTEMPTS - attemptNumber,
      sessionId,
      placeIds,
    },
    session: next,
  };
}

// --- 3) Complete the reset (authorize the password write) ------------------
export function completeReset(session, data, deps) {
  if (!validateNewPassword(data?.newPassword).ok) return { error: 'bad_password', session };

  const s = session;
  const tok = s?.resetToken;
  if (!tok?.hash) return { error: 'no_reset', session: s };

  if (deps.now() > tok.expiresAt) {
    return { error: 'expired', session: { ...s, resetToken: null } };
  }
  if (deps.hash(data.resetToken) !== tok.hash) {
    return { error: 'bad_token', session: s };
  }

  // Identity proven + token valid → authorize the password write and reset state
  // (chances back to 3, lockout cleared, leaderboard restored).
  const next = {
    ...s,
    attemptNumber: 0,
    pending: null,
    resetToken: null,
    lockedUntilLogin: false,
  };
  return { response: { status: 'reset_complete' }, session: next, setPassword: true, unhide: true };
}
