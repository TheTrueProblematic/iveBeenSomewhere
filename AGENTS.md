# AGENTS Documentation

## Maintenance Policy (READ FIRST)
**Whenever you make a change to this project, you MUST keep `AGENTS.md` and `README.md` up to date in the same change.** If you add, remove, or alter a feature, a build/run/deploy step, the data model, or the tech stack, update both documents to match before considering the task complete. Treat these docs as part of the deliverable, not an afterthought.

## Project Architecture
This project is built using:
- **React + Vite**: For a fast, modern frontend development experience.
- **Tailwind CSS**: For responsive, atomic styling and utility classes. The visual theme is a vintage "Man in Black" / worn road-atlas aesthetic. Use Lucide icons or text — **no emojis** in the UI.
- **React-Leaflet / Leaflet**: For the interactive map component, allowing for both city markers and state/country polygons.
- **Zustand**: For lightweight, centralized state management (the `visitedPlaces` store plus `user`, modal, and audio state in `src/store.js`).
- **Firebase**: Used for Authentication (username + password via virtual emails) and Firestore (storing user visited lists and the global leaderboard).

## Features
- **Interactive Map** (`src/components/MapTracker.jsx`): Cities render as pins, states/countries as GeoJSON polygons. Includes:
  - A **fullscreen toggle** (uses the native Fullscreen API; calls Leaflet's `invalidateSize()` on `fullscreenchange` so the map reflows).
  - **Visited vs. unvisited styling**: visited pins are larger and carry a pulsing gold glow; unvisited pins are heavily desaturated (near-monochrome) so visited places stand out. Pin filters live in `src/index.css` (`.visited-pin` / `.unvisited-pin`).
- **List View** (`src/components/ListTracker.jsx`): Chronological list of every place in the song.
- **Leaderboard** (`src/components/Leaderboard.jsx`): Global leaderboard tracking percentage of places visited, read from the Firestore `users` collection.
- **Accounts**: Sign in / sign up via `AuthModal.jsx`. The signed-in user's chip in the header opens a **User Settings modal** (`src/components/UserSettingsModal.jsx`), which currently holds the Log Out action.
- **Background audio** (`src/components/BackgroundAudio.jsx`): Quiet, gapless music (intro then seamless loop); mute state persists in `localStorage`.

## Data Structure
- `public/places.json`: Contains the 91 locations mentioned in Johnny Cash's "I've Been Everywhere". Includes coordinates and GeoJSON polygons (generated via Nominatim) to accurately render state/country boundaries.
- **Firestore Schema** (implemented):
  - `users/{uid}`: Stores `username`, `visitedCount`, and a `visitedPlaces` array.
  - `usernames/{username}`: Reserves a lowercased username and maps it to its `uid` (enforces unique usernames). Auth uses virtual emails of the form `username@ivebeensomewhere.tp`.

## Local Testing
To test the application locally without full Firebase setup:
1. Run `./run_local.sh`.
2. This runs the app with `VITE_TEST_MODE=true`, which uses mock Firebase authentication (auto-logging in as a test user) and mock data for the leaderboard and Firestore.

## Deployment
The app is hosted on **Firebase Hosting** (project `ivebeensomewhere-tp`, on the free Spark plan). Only deploy when **explicitly approved by the user**. Once approved:
1. Build the app: `npm run build` (produces `dist/`; do NOT build in test mode for production).
2. Deploy: `firebase deploy --only hosting --project ivebeensomewhere-tp`.
3. Live URL: https://ivebeensomewhere-tp.web.app

**Auth gotcha:** Email/Password sign-in must be enabled in the Firebase Console (Authentication → Sign-in method). It cannot be enabled via CLI/config on the free plan, and there is no Firebase CLI deploy target for auth providers.
