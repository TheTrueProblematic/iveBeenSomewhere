import React, { useEffect, useState } from 'react';
import { Trophy, Award } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, isTestMode } from '../firebase';
import Avatar from './Avatar';

// Visual treatment per rank — gold / silver / bronze, then the rest
const RANK_STYLES = [
  { badge: 'bg-brass-gradient text-ink shadow-glow ring-1 ring-gold/50', bar: 'from-brass to-gold' },
  { badge: 'bg-gradient-to-br from-paper-dark to-ash/60 text-ink', bar: 'from-ash to-paper-dark' },
  { badge: 'bg-gradient-to-br from-rust to-oxblood text-paper-light', bar: 'from-oxblood to-rust' },
];

export default function Leaderboard({ total = 0 }) {
  // Only ever shows real users from Firestore — no mock/placeholder entries.
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    if (isTestMode) return;

    // Real-time listener for every user in Firestore, ranked by places visited.
    const q = query(
      collection(db, 'users'),
      orderBy('visitedCount', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Hidden as a penalty for failing the password-reset quiz 3x; restored
        // when they next sign in with their real password (see Cloud Functions).
        if (data.leaderboardHidden) return;
        list.push({
          id: doc.id,
          name: data.username || 'Anonymous',
          profileImage: data.profileImage || null,
          // Store the raw count; percentage is computed at render time against
          // the same total the header uses, so the two always agree.
          count: data.visitedCount || 0
        });
      });

      setLeaders(list);
    }, (err) => {
      console.error("Firestore leaderboard query error:", err);
    });

    return () => unsubscribe();
  }, []);

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
        {leaders.length === 0 && (
          <p className="px-4 py-8 text-center font-typewriter text-sm text-ash">
            No travelers on the board yet &mdash; be the first to mark a place!
          </p>
        )}
        <ul className="divide-y divide-ink/10">
          {leaders.map((leader, i) => {
            const rank = RANK_STYLES[i] ?? { badge: 'bg-paper-dark text-ash', bar: 'from-denim to-ash' };
            // Same formula and rounding as the header banner, so they match.
            const percent = total > 0 ? Math.round((leader.count / total) * 100) : 0;
            return (
              <li key={leader.id} className="flex items-center gap-3 p-4">
                <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-sm font-display text-base font-bold ${rank.badge}`}>
                  {i + 1}
                </span>
                <div className="relative shrink-0">
                  <Avatar
                    name={leader.name}
                    profileImage={leader.profileImage}
                    className={`h-10 w-10 overflow-hidden rounded-sm text-lg ${
                      i === 0 ? 'ring-2 ring-gold/60' : 'ring-1 ring-ink/10'
                    }`}
                  />
                  {i === 0 && (
                    <Award className="absolute -bottom-2 -right-2 h-6 w-6 text-brass fill-gold drop-shadow-md animate-wiggle" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-semibold text-ink">{leader.name}</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dark">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${rank.bar} transition-[width] duration-700 ease-out`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-typewriter text-sm font-bold text-ash">
                      {percent}%
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
