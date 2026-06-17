import React from 'react';
import { Trophy, Award } from 'lucide-react';

// Visual treatment per rank — gold / silver / bronze, then the rest
const RANK_STYLES = [
  { badge: 'bg-brass-gradient text-ink shadow-glow ring-1 ring-gold/50', bar: 'from-brass to-gold' },
  { badge: 'bg-gradient-to-br from-paper-dark to-ash/60 text-ink', bar: 'from-ash to-paper-dark' },
  { badge: 'bg-gradient-to-br from-rust to-oxblood text-paper-light', bar: 'from-oxblood to-rust' },
];

export default function Leaderboard() {
  // In a real app, this would fetch from Firestore.
  // For local testing, we'll display mock data if needed, or just a placeholder.
  const leaders = [
    { id: '1', name: 'Johnny Fan', percent: 85 },
    { id: '2', name: 'Traveler99', percent: 42 },
    { id: '3', name: 'test-user-123', percent: 0 },
  ];

  return (
    <div className="rounded-2xl bg-rail-gradient bg-[length:200%_auto] animate-gradient p-[3px] shadow-card animate-risein">
      <div className="overflow-hidden rounded-[0.85rem] bg-paper-light/95">
        <div className="p-4 border-b border-ink/10 bg-ink/95">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-paper-light">
            <Trophy className="h-5 w-5 text-brass" />
            Hall of Fame
          </h2>
          <p className="font-typewriter text-sm text-brass">Who&rsquo;s been everywhere</p>
        </div>
        <ul className="divide-y divide-ink/10">
          {leaders.map((leader, i) => {
            const rank = RANK_STYLES[i] ?? { badge: 'bg-paper-dark text-ash', bar: 'from-denim to-ash' };
            return (
              <li key={leader.id} className="flex items-center gap-3 p-4">
                <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-sm font-display text-base font-bold ${rank.badge}`}>
                  {i + 1}
                  {i === 0 && (
                    <Award className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-brass fill-gold animate-float" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-semibold text-ink">{leader.name}</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dark">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${rank.bar} transition-[width] duration-700 ease-out`}
                        style={{ width: `${leader.percent}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-typewriter text-sm font-bold text-ash">
                      {leader.percent}%
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
