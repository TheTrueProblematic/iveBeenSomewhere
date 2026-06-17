import React, { useEffect, useRef, useState } from 'react';
import { Compass, Star, Award } from 'lucide-react';

// Smoothly animates a number toward `target` like a turning odometer.
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef();

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

const MILESTONES = [
  { at: 100, label: "You've Been Everywhere", blurb: 'Every last stop. The Man in Black would tip his hat.' },
  { at: 75, label: 'Almost Everywhere', blurb: "The whole map's lighting up gold." },
  { at: 50, label: 'Halfway Down the Line', blurb: 'Miles of road behind you now.' },
  { at: 25, label: 'Rolling Now', blurb: "The journey's well under way." },
  { at: 1, label: 'The Journey Begins', blurb: 'First stops marked on the map.' },
  { at: 0, label: 'Ready to Ride', blurb: 'Pick a place to start your travels.' },
];

const CHECKPOINTS = [0, 25, 50, 75, 100];

export default function ProgressBanner({ percent, visitedCount, total }) {
  const animatedPercent = useCountUp(percent);
  const milestone = MILESTONES.find((m) => percent >= m.at) ?? MILESTONES[MILESTONES.length - 1];

  return (
    <section className="relative overflow-hidden rounded-2xl bg-cash-gradient bg-[length:200%_auto] animate-gradient p-[3px] shadow-card animate-risein">
      <div className="relative rounded-[0.85rem] bg-paper-light/95 px-6 py-6 md:px-8 md:py-7 ring-1 ring-ink/10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          {/* Big number */}
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-ink text-brass shadow-glow ring-1 ring-brass/40">
              <Compass className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-end gap-1 leading-none">
                <span className="font-display text-5xl md:text-6xl font-bold text-oxblood">
                  {Math.round(animatedPercent)}
                </span>
                <span className="font-display text-2xl md:text-3xl font-bold text-rust mb-1">%</span>
              </div>
              <p className="mt-1 font-typewriter text-sm tracking-wide text-ash">
                {visitedCount} of {total} places explored
              </p>
            </div>
          </div>

          {/* Milestone message */}
          <div className="md:text-right">
            <p className="flex items-center gap-2 font-display text-xl font-semibold uppercase tracking-wide text-ink md:justify-end">
              {percent === 100 ? (
                <Award className="h-5 w-5 text-brass animate-wiggle" />
              ) : (
                <Star className="h-5 w-5 text-brass" />
              )}
              {milestone.label}
            </p>
            <p className="mt-1 font-typewriter text-sm text-ash">{milestone.blurb}</p>
          </div>
        </div>

        {/* Progress track with checkpoints */}
        <div className="relative mt-6">
          <div className="shimmer-sweep h-4 w-full rounded-full bg-paper-dark ring-1 ring-ink/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-oxblood via-rust to-brass transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(percent, percent > 0 ? 4 : 0)}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between">
            {CHECKPOINTS.map((cp) => {
              const reached = percent >= cp;
              return (
                <div key={cp} className="flex flex-col items-center gap-1">
                  <span
                    className={`h-3 w-3 rounded-full ring-2 ring-paper-light transition-all ${
                      reached ? 'bg-brass shadow-glow scale-110' : 'bg-paper-dark'
                    }`}
                  />
                  <span
                    className={`font-typewriter text-[11px] font-bold ${
                      reached ? 'text-oxblood' : 'text-ash/60'
                    }`}
                  >
                    {cp}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
