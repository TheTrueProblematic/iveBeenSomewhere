import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Loader2, MapPin, Check, X, ShieldCheck, KeyRound, AlertTriangle, Lock,
} from 'lucide-react';
import {
  requestChallenge, submitChallenge, completeReset,
} from '../passwordResetClient';

// The identity-proof reset flow. It only ever shows the user a list of places to
// sort — it never learns which are "correct". Eligibility, grading, the attempt
// budget and the actual password change are all decided by the trusted backend;
// this component just relays inputs and renders the backend's verdict.
//
// Props:
//   places          - the full static place list (for looking up names by id)
//   initialUsername - the username typed on the sign-in screen
//   onBack          - return to the sign-in form
//   onResetComplete - called after a successful reset (returns to sign-in)
export default function PasswordResetFlow({ places, initialUsername, onBack, onResetComplete }) {
  // step: loading | quiz | setpw | done | ineligible | locked | unavailable | error
  const [step, setStep] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [sessionId, setSessionId] = useState(null);
  const [tiles, setTiles] = useState([]); // [{ id, name, type }]
  const [answers, setAnswers] = useState({}); // { id: boolean been }
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [retryNotice, setRetryNotice] = useState('');

  const [resetToken, setResetToken] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const username = (initialUsername || '').trim();

  // Look up a place's display fields from the static list (never reveals visited
  // status — that lives only behind the owner's private doc / the backend).
  const placeById = useMemo(() => {
    const m = new Map();
    (places || []).forEach((p) => m.set(String(p.id), p));
    return m;
  }, [places]);

  const hydrate = (list) =>
    (list || []).map((entry) => {
      const id = String(entry.id);
      const p = placeById.get(id);
      return { id, name: p?.name || entry.name || `Place ${id}`, type: p?.type || entry.type || '' };
    });

  // Kick off a challenge request when the flow opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await requestChallenge(username);
        if (cancelled) return;
        applyChallengeResponse(res);
      } catch (err) {
        if (cancelled) return;
        console.error('requestChallenge error:', err);
        setStep('error');
        setError('Something went wrong starting the verification. Please try again.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyChallengeResponse(res) {
    switch (res?.status) {
      case 'challenge':
        setSessionId(res.sessionId);
        setTiles(hydrate(res.places));
        setAnswers({});
        setAttemptsRemaining(res.attemptsRemaining);
        setStep('quiz');
        break;
      case 'ineligible':
        setStep('ineligible');
        break;
      case 'locked':
        setStep('locked');
        break;
      case 'unavailable':
      default:
        setStep('unavailable');
        break;
    }
  }

  const allSorted = tiles.length > 0 && tiles.every((t) => typeof answers[t.id] === 'boolean');
  const sortedCount = tiles.filter((t) => typeof answers[t.id] === 'boolean').length;

  const setAnswer = (id, been) => {
    setRetryNotice('');
    setAnswers((prev) => ({ ...prev, [id]: been }));
  };

  const handleSubmitQuiz = async () => {
    if (!allSorted || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await submitChallenge(username, sessionId, answers);
      if (res?.status === 'passed') {
        setResetToken(res.resetToken);
        setStep('setpw');
      } else if (res?.status === 'failed') {
        setSessionId(res.sessionId);
        setTiles(hydrate(res.places));
        setAnswers({});
        setAttemptsRemaining(res.attemptsRemaining);
        setRetryNotice(
          `That sorting wasn't quite right. ${res.attemptsRemaining} ${
            res.attemptsRemaining === 1 ? 'try' : 'tries'
          } left.`,
        );
      } else if (res?.status === 'failed_locked') {
        setStep('locked');
      } else {
        setStep('unavailable');
      }
    } catch (err) {
      console.error('submitChallenge error:', err);
      setError('Could not check your answers. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await completeReset(username, resetToken, newPw);
      if (res?.status === 'reset_complete') {
        setStep('done');
      } else {
        setError('Could not reset your password. Please start over.');
      }
    } catch (err) {
      console.error('completeReset error:', err);
      setError(err?.message || 'Could not reset your password. Please start over.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-md border-2 border-brass/40 bg-paper/30 py-2 pl-10 pr-4 font-typewriter text-sm text-ink outline-none transition-all focus:border-brass focus:bg-paper-light focus:ring-1 focus:ring-brass';

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-sm p-1 text-ash/70 transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="Back to sign in"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brass" />
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Verify it&rsquo;s you</h2>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-oxblood/30 bg-oxblood/5 p-3 font-typewriter text-xs text-oxblood">
          {error}
        </div>
      )}

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-ash">
          <Loader2 className="h-6 w-6 animate-spin text-brass" />
          <p className="font-typewriter text-xs">Pulling your trail&hellip;</p>
        </div>
      )}

      {/* Quiz */}
      {step === 'quiz' && (
        <>
          <p className="mb-3 font-typewriter text-xs leading-relaxed text-ash">
            Prove this logbook is yours. For each place below, say whether
            <span className="font-bold text-ink"> you&rsquo;ve been there</span> or not. Get all ten
            right.
          </p>
          <div className="mb-3 flex items-center justify-between font-typewriter text-[0.7rem] text-ash/80">
            <span>{sortedCount} / {tiles.length} sorted</span>
            {attemptsRemaining != null && (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {attemptsRemaining} {attemptsRemaining === 1 ? 'try' : 'tries'} left
              </span>
            )}
          </div>

          {retryNotice && (
            <div className="mb-3 rounded-md border border-rust/30 bg-rust/5 p-2.5 font-typewriter text-[0.7rem] text-rust animate-fade-in-up">
              {retryNotice}
            </div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {tiles.map((t) => {
              const choice = answers[t.id];
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-paper/40 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-brass" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-ink">{t.name}</p>
                      {t.type && (
                        <p className="font-typewriter text-[0.6rem] uppercase tracking-wider text-ash/60">
                          {t.type}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setAnswer(t.id, true)}
                      className={`flex items-center gap-1 rounded-sm border px-2 py-1 font-display text-[0.65rem] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                        choice === true
                          ? 'border-brass bg-brass-gradient text-ink shadow-glow'
                          : 'border-ink/20 bg-paper-light/60 text-ash hover:border-brass/50'
                      }`}
                    >
                      <Check className="h-3 w-3" /> Been
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnswer(t.id, false)}
                      className={`flex items-center gap-1 rounded-sm border px-2 py-1 font-display text-[0.65rem] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                        choice === false
                          ? 'border-oxblood bg-oxblood/85 text-white shadow-card'
                          : 'border-ink/20 bg-paper-light/60 text-ash hover:border-oxblood/50'
                      }`}
                    >
                      <X className="h-3 w-3" /> Haven&rsquo;t
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSubmitQuiz}
            disabled={!allSorted || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brass-gradient py-2.5 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Check my answers</>}
          </button>
        </>
      )}

      {/* Set new password */}
      {step === 'setpw' && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="mb-1 flex gap-3 rounded-md border border-emerald-700/30 bg-emerald-700/5 p-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-800" />
            <p className="font-typewriter text-xs text-emerald-800">
              Identity confirmed. Set a new password for <span className="font-bold">{username}</span>.
            </p>
          </div>
          <PwField label="New password" value={newPw} onChange={setNewPw} inputClass={inputClass} autoFocus />
          <PwField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} inputClass={inputClass} />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brass-gradient py-2.5 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Set new password</>}
          </button>
        </form>
      )}

      {/* Success */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-brass-gradient text-ink shadow-glow">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-ink">You&rsquo;re back on the road</h3>
          <p className="font-typewriter text-xs text-ash">Your password has been reset. Sign in with your new password.</p>
          <button
            onClick={onResetComplete}
            className="mt-2 rounded-md bg-brass-gradient px-6 py-2 font-display text-sm font-bold uppercase tracking-wider text-ink shadow-glow transition-all hover:brightness-105 active:scale-95"
          >
            Back to sign in
          </button>
        </div>
      )}

      {/* Terminal states */}
      {(step === 'ineligible' || step === 'locked' || step === 'unavailable' || step === 'error') && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-md border border-oxblood/40 bg-oxblood/10 text-oxblood">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="font-typewriter text-xs leading-relaxed text-ash">
            {step === 'ineligible' &&
              "We can't verify this logbook automatically — there isn't enough of a distinctive travel history on record to build a fair test."}
            {step === 'locked' &&
              'Password reset is unavailable for now. Sign in with your existing password to unlock it again.'}
            {step === 'unavailable' &&
              "We couldn't start a verification for that account."}
            {step === 'error' && 'Please try again in a moment.'}
          </p>
          <button
            onClick={onBack}
            className="mt-2 rounded-md border border-ink/30 bg-ink/5 px-6 py-2 font-display text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-ink/15 active:scale-95"
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

function PwField({ label, value, onChange, inputClass, autoFocus = false }) {
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
          maxLength={1024}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>
    </div>
  );
}
