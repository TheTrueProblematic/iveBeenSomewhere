import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon } from 'lucide-react';
import { useStore } from '../store';

// Custom Johnny Cash icons — visited pins are noticeably larger so they pop
// on the map (CSS scale() can't be used because Leaflet positions the same
// element with an inline transform).
const unvisitedIcon = L.icon({
    iconUrl: '/JCPinIcon.webp',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
    className: 'unvisited-pin'
});

const visitedIcon = L.icon({
    iconUrl: '/JCPinIcon.webp',
    iconSize: [52, 52],
    iconAnchor: [26, 52],
    popupAnchor: [0, -52],
    className: 'visited-pin'
});

export default function MapTracker({ places, onSelectPlace }) {
  const { visitedPlaces } = useStore();

  const renderPlaces = (offset = 0) => {
    return places.map((place) => {
      const isVisited = visitedPlaces.has(place.id);
      const icon = isVisited ? visitedIcon : unvisitedIcon;
      const key = `${place.id}_offset_${offset}`;

      if (place.geojson) {
        let currentGeoJSON = place.geojson;
        if (offset !== 0) {
          currentGeoJSON = JSON.parse(JSON.stringify(place.geojson));
          const shiftCoords = (coords) => {
            if (typeof coords[0] === 'number') {
              coords[0] += offset;
            } else {
              coords.forEach(shiftCoords);
            }
          };
          // Usually nominatim returns geometry objects directly, e.g., { type: 'Polygon', coordinates: [] }
          if (currentGeoJSON.coordinates) {
             shiftCoords(currentGeoJSON.coordinates);
          } else if (currentGeoJSON.geometry && currentGeoJSON.geometry.coordinates) {
             shiftCoords(currentGeoJSON.geometry.coordinates);
          }
        }

        const style = {
            color: isVisited ? '#c79a3a' : '#4a3f36', // brass if visited, ink if not
            weight: isVisited ? 3 : 2,
            opacity: 0.9,
            fillColor: isVisited ? '#a23b2c' : '#3f5a63',
            fillOpacity: isVisited ? 0.38 : 0.1
        };
        return (
          <GeoJSON
            key={key}
            data={currentGeoJSON}
            style={style}
            eventHandlers={{
                click: () => onSelectPlace(place)
            }}
          >
             <Popup>{place.name}</Popup>
          </GeoJSON>
        );
      } else {
         // Render as marker for city
         return (
           <Marker
             key={key}
             position={[place.lat, place.lon + offset]}
             icon={icon}
             eventHandlers={{
                 click: () => onSelectPlace(place)
             }}
           >
             <Popup>{place.name}</Popup>
           </Marker>
         )
      }
    });
  };

  return (
    <div className="rounded-2xl bg-rail-gradient bg-[length:200%_auto] animate-gradient p-[3px] shadow-card animate-risein">
      <div className="overflow-hidden rounded-[0.85rem] bg-paper-light/95">
        {/* Map header + legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-ink/10 bg-ink/95">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-paper-light">
            <MapIcon className="h-5 w-5 text-brass" />
            The Road Atlas
          </h2>
          <div className="flex items-center gap-4 font-typewriter text-xs">
            <span className="flex items-center gap-1.5 text-gold">
              <span className="h-3 w-3 rounded-full bg-brass shadow-glow" />
              Visited
            </span>
            <span className="flex items-center gap-1.5 text-paper/70">
              <span className="h-3 w-3 rounded-full bg-denim/80" />
              Still to explore
            </span>
          </div>
        </div>

        {/* MinZoom restricts zooming out past ~3 worlds; maxBounds restricts panning */}
        <div className="h-[560px] w-full">
          <MapContainer
            center={[39.8283, -98.5795]}
            zoom={4}
            minZoom={2}
            maxBounds={[[-90, -540], [90, 540]]}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              subdomains="abcd"
              noWrap={false}
            />

            {/* Render markers across the main map and adjacent duplicated maps */}
            {renderPlaces(0)}
            {renderPlaces(-360)}
            {renderPlaces(360)}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
