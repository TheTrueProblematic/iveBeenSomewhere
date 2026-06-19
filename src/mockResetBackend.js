// mockResetBackend.js — TEST-MODE ONLY simulation of the reset Cloud Functions.
//
// This is NOT security-relevant: the real grading, attempt-limiting and password
// write all happen server-side in functions/index.js. This mock exists purely so
// the reset UI can be walked through offline via ./run_local.sh, without standing
// up Firebase. It is loaded only via a dynamic import in test mode, so it never
// ships in the production bundle.
//
// The mock user "has been" to place ids 0–39 (count 40 → the middle band, where a
// challenge shows 3–7 visited tiles). To pass the quiz in test mode, mark tiles
// whose id is < 40 as "Been" and the rest as "Haven't Been".

const QUIZ_SIZE = 10;
const MAX_ATTEMPTS = 3;
const ALL_IDS = Array.from({ length: 91 }, (_, i) => String(i));
const MOCK_VISITED = new Set(Array.from({ length: 40 }, (_, i) => String(i)));

let state = freshState();
function freshState() {
  return { attemptNumber: 0, pending: null, resetToken: null, locked: false };
}

function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function buildChallenge() {
  const visited = [...MOCK_VISITED];
  const unvisited = ALL_IDS.filter((id) => !MOCK_VISITED.has(id));
  const nVisited = 3 + Math.floor(Math.random() * 5); // 3..7
  const chosenV = sample(visited, nVisited);
  const chosenU = sample(unvisited, QUIZ_SIZE - nVisited);
  const answerKey = {};
  chosenV.forEach((id) => { answerKey[id] = true; });
  chosenU.forEach((id) => { answerKey[id] = false; });
  return {
    sessionId: Math.random().toString(36).slice(2),
    placeIds: sample([...chosenV, ...chosenU], QUIZ_SIZE),
    answerKey,
  };
}

function grade(answerKey, answers) {
  const ids = Object.keys(answerKey);
  if (!answers || Object.keys(answers).length !== ids.length) return false;
  return ids.every((id) => answers[id] === answerKey[id]);
}

export async function mockCall(name, data = {}) {
  await new Promise((r) => setTimeout(r, 250)); // feel like a network round-trip

  switch (name) {
    case 'requestPasswordResetChallenge': {
      if (state.locked) return { status: 'locked' };
      if (!state.pending) state.pending = buildChallenge();
      return {
        status: 'challenge',
        sessionId: state.pending.sessionId,
        places: state.pending.placeIds.map((id) => ({ id })),
        attemptsRemaining: MAX_ATTEMPTS - state.attemptNumber,
      };
    }
    case 'submitPasswordResetChallenge': {
      if (state.locked) return { status: 'failed_locked' };
      if (!state.pending) throw new Error('No active challenge.');
      if (data.sessionId !== state.pending.sessionId) throw new Error('Stale session.');
      if (grade(state.pending.answerKey, data.answers)) {
        state.resetToken = Math.random().toString(36).slice(2);
        state.pending = null;
        return { status: 'passed', resetToken: state.resetToken };
      }
      state.attemptNumber += 1;
      if (state.attemptNumber >= MAX_ATTEMPTS) {
        state.locked = true;
        state.pending = null;
        return { status: 'failed_locked' };
      }
      state.pending = buildChallenge();
      return {
        status: 'failed',
        attemptsRemaining: MAX_ATTEMPTS - state.attemptNumber,
        sessionId: state.pending.sessionId,
        places: state.pending.placeIds.map((id) => ({ id })),
      };
    }
    case 'completePasswordReset': {
      if (!state.resetToken || data.resetToken !== state.resetToken) {
        throw new Error('Invalid reset token.');
      }
      if (typeof data.newPassword !== 'string' || data.newPassword.length < 6) {
        throw new Error('Password too short.');
      }
      state = freshState();
      return { status: 'reset_complete' };
    }
    case 'clearResetStateOnLogin': {
      state = freshState();
      return { status: 'ok' };
    }
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}
