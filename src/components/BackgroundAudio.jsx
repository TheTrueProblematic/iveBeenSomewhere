import { useEffect, useRef } from 'react';
import { useStore } from '../store';

/**
 * Quiet, gapless background music.
 *
 * Plays an intro ("start") buffer once, then loops the "loop" buffer forever.
 * Uses the Web Audio API so the start->loop and loop->loop transitions are
 * sample-accurate with no audible gap (an HTML <audio> element can't guarantee
 * this). Browsers block audio until a user gesture, so if autoplay is rejected
 * we resume the AudioContext on the first click / key / touch.
 *
 * Muting is driven by the shared store (`audioMuted`) and applied to the gain
 * node with a short ramp — it never restarts or reschedules playback.
 */
export default function BackgroundAudio({ startSrc, loopSrc, volume = 0.2 }) {
  const muted = useStore((s) => s.audioMuted);
  const gainRef = useRef(null);
  const mutedRef = useRef(muted);

  // Apply mute / volume changes smoothly without touching the scheduled sources.
  useEffect(() => {
    mutedRef.current = muted;
    const gain = gainRef.current;
    if (gain) {
      const target = muted ? 0 : volume;
      try {
        gain.gain.setTargetAtTime(target, gain.context.currentTime, 0.04);
      } catch (_) {
        gain.gain.value = target;
      }
    }
  }, [muted, volume]);

  useEffect(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = mutedRef.current ? 0 : volume;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    let disposed = false;
    let started = false;
    let startBuffer = null;
    let loopBuffer = null;
    const sources = [];

    const gestureEvents = ['pointerdown', 'keydown', 'touchstart'];
    const removeGestureListeners = () => {
      gestureEvents.forEach((e) => window.removeEventListener(e, onGesture));
    };

    // Schedule the intro and the (forever) loop so they butt up against each
    // other exactly, sample-accurate -> no gap.
    const begin = () => {
      if (started || disposed) return;
      if (ctx.state !== 'running') return;
      if (!startBuffer || !loopBuffer) return;
      started = true;
      removeGestureListeners();

      const startAt = ctx.currentTime + 0.06; // small lead so both are queued

      const intro = ctx.createBufferSource();
      intro.buffer = startBuffer;
      intro.connect(gain);
      intro.start(startAt);
      sources.push(intro);

      const loop = ctx.createBufferSource();
      loop.buffer = loopBuffer;
      loop.loop = true;
      loop.connect(gain);
      loop.start(startAt + startBuffer.duration); // begins the instant the intro ends
      sources.push(loop);
    };

    const tryResumeAndBegin = () => {
      ctx.resume().then(begin).catch(() => {});
    };

    const onGesture = () => tryResumeAndBegin();

    const decode = async (url) => {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    };

    Promise.all([decode(startSrc), decode(loopSrc)])
      .then(([sb, lb]) => {
        if (disposed) return;
        startBuffer = sb;
        loopBuffer = lb;
        // Try immediately (some contexts are already running); otherwise the
        // gesture listeners below will kick it off.
        tryResumeAndBegin();
        if (!started) {
          gestureEvents.forEach((e) =>
            window.addEventListener(e, onGesture, { passive: true })
          );
        }
      })
      .catch((err) => console.error('Background audio load error:', err));

    return () => {
      disposed = true;
      removeGestureListeners();
      sources.forEach((s) => {
        try { s.stop(); } catch (_) { /* already stopped */ }
      });
      gainRef.current = null;
      ctx.close().catch(() => {});
    };
  }, [startSrc, loopSrc, volume]);

  return null;
}
