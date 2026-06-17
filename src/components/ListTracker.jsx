import React from 'react';
import { useStore } from '../store';
import { MapPin, CheckCircle2, ListChecks, Building2, Map as MapIcon, Globe } from 'lucide-react';

const TYPE_BADGE = {
  city: { label: 'City', Icon: Building2, className: 'bg-denim/15 text-denim' },
  state: { label: 'State', Icon: MapIcon, className: 'bg-brass/20 text-ash' },
  country: { label: 'Country', Icon: Globe, className: 'bg-oxblood/15 text-oxblood' },
};

export default function ListTracker({ places, onSelectPlace }) {
  const { visitedPlaces } = useStore();
  const percent = places.length > 0 ? (visitedPlaces.size / places.length) * 100 : 0;

  return (
    <div className="rounded-2xl bg-cash-gradient bg-[length:200%_auto] animate-gradient p-[3px] shadow-card animate-risein">
      <div className="overflow-hidden rounded-[0.85rem] bg-paper-light/95">
        <div className="p-4 border-b border-ink/10 bg-ink/95">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-paper-light">
              <ListChecks className="h-5 w-5 text-brass" />
              Everywhere You&rsquo;ve Been
            </h2>
            <span className="rounded-sm bg-brass-gradient px-3 py-1 font-typewriter text-xs font-bold text-ink">
              {visitedPlaces.size} / {places.length}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-coal">
            <div
              className="h-full rounded-full bg-gradient-to-r from-oxblood via-rust to-brass transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ul className="fancy-scroll max-h-[520px] overflow-y-auto divide-y divide-ink/10">
          {places.map((place, index) => {
            const isVisited = visitedPlaces.has(place.id);
            const badge = TYPE_BADGE[place.type] ?? TYPE_BADGE.city;
            const BadgeIcon = badge.Icon;
            return (
              <li
                key={place.id}
                className={`group flex items-center justify-between gap-3 p-3.5 cursor-pointer transition-all hover:bg-brass/10 ${
                  isVisited ? 'bg-gradient-to-r from-brass/15 to-transparent' : ''
                }`}
                onClick={() => onSelectPlace(place)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm font-typewriter text-xs font-bold transition-transform group-hover:scale-110 ${
                      isVisited
                        ? 'bg-brass-gradient text-ink shadow-glow'
                        : 'bg-paper-dark text-ash'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block truncate font-display text-base font-semibold ${
                        isVisited ? 'text-oxblood' : 'text-ink'
                      }`}
                    >
                      {place.name}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-typewriter text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  {isVisited ? (
                    <CheckCircle2 className="h-6 w-6 text-brass animate-pop" />
                  ) : (
                    <MapPin className="h-5 w-5 text-ash/40 transition-colors group-hover:text-brass" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
