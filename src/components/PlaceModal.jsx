import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X, Check, MapPin, Star, Building2, Map as MapIcon, Globe } from 'lucide-react';

const TYPE_THEME = {
  city: { gradient: 'from-ash via-denim to-ink', Icon: Building2 },
  state: { gradient: 'from-oxblood via-brick to-rust', Icon: MapIcon },
  country: { gradient: 'from-rust via-brick to-brass', Icon: Globe },
};

export default function PlaceModal({ place, onClose }) {
  const { visitedPlaces, toggleVisited } = useStore();
  const [burstKey, setBurstKey] = useState(0);

  // Reset any lingering celebration when switching places
  useEffect(() => {
    setBurstKey(0);
  }, [place?.id]);

  if (!place) return null;

  const isVisited = visitedPlaces.has(place.id);
  const theme = TYPE_THEME[place.type] ?? TYPE_THEME.city;
  const TypeIcon = theme.Icon;

  const handleToggle = () => {
    const willVisit = !isVisited;
    toggleVisited(place.id);
    if (willVisit) setBurstKey((k) => k + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-paper-light shadow-2xl ring-1 ring-brass/40 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient banner */}
        <div className={`relative bg-gradient-to-br ${theme.gradient} bg-[length:200%_auto] animate-gradient px-6 pt-6 pb-10`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-sm bg-paper-light/20 text-paper-light backdrop-blur-sm transition-colors hover:bg-paper-light/35"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="grid h-14 w-14 place-items-center rounded-md bg-paper-light/15 text-paper-light ring-1 ring-paper-light/25 animate-float">
            <TypeIcon className="h-7 w-7" />
          </div>
          <span className="mt-3 inline-block rounded-sm bg-paper-light/20 px-3 py-1 font-typewriter text-xs font-bold uppercase tracking-wider text-paper-light backdrop-blur-sm">
            {place.type}
          </span>
        </div>

        <div className="relative -mt-5 rounded-t-xl bg-paper-light px-6 pb-6 pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">{place.name}</h2>
            {isVisited && (
              <span className="mt-1 flex shrink-0 items-center gap-1 rounded-sm bg-brass/20 px-2.5 py-1 font-typewriter text-xs font-bold text-oxblood">
                <Check className="h-3.5 w-3.5" /> Visited
              </span>
            )}
          </div>

          <p className="mt-3 font-serif leading-relaxed text-ash">{place.desc}</p>

          <div className="relative mt-7">
            {/* Celebration burst rings */}
            {burstKey > 0 && (
              <div
                key={burstKey}
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-brass"
              >
                <span className="burst-ring h-16 w-16" />
                <span className="burst-ring h-16 w-16" style={{ animationDelay: '0.12s' }} />
                <Star className="absolute h-6 w-6 animate-ping text-gold" />
              </div>
            )}

            <button
              onClick={handleToggle}
              className={`relative w-full rounded-md px-4 py-3.5 font-display text-lg font-semibold uppercase tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                isVisited
                  ? 'bg-brass/15 text-oxblood hover:bg-brass/25 ring-1 ring-oxblood/30'
                  : 'bg-cash-gradient bg-[length:200%_auto] animate-gradient text-paper-light shadow-glow hover:shadow-glow-strong'
              }`}
            >
              {isVisited ? (
                <>
                  <Check className="h-5 w-5" />
                  I&rsquo;ve Been There (Unmark)
                </>
              ) : (
                <>
                  <MapPin className="h-5 w-5" />
                  Mark as Visited
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
