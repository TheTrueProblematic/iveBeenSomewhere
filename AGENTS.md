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
- **Leaderboard** (`src/components/Leaderboard.jsx`): Global leaderboard tracking percentage of places visited, read from the Firestore `users` collection. Each entry shows the traveler's `Avatar` (their chosen `profileImage` or the monogram fallback) alongside their rank, name, and progress bar.
- **Accounts**: Sign in / sign up via `AuthModal.jsx`. The signed-in user's chip in the header opens a **User Settings modal** (`src/components/UserSettingsModal.jsx`). The modal is a single component with several panels (a `view` state machine):
  - **Profile header**: the avatar and username sit at the top. Clicking the username opens an inline rename; clicking the avatar opens the profile-picture picker.
  - **Change username**: updates the Firebase Auth display name *and* login email (the username is the login identity via the virtual email), reserves the new `usernames/{name}` doc, releases the old one, and updates `users/{uid}.username`.
  - **Profile picture**: a scrollable grid of preset avatars plus the monogram fallback. Options come from `src/ProfileImages/` (see Data Structure). The chosen key is saved to `users/{uid}.profileImage`.
  - **Change password**: re-authenticates with the current password, then sets the new one (entered twice to confirm).
  - **Delete account**: requires the password to confirm (which also re-authenticates), then removes the Firestore docs and the Auth user.
- **Avatars**: `src/components/Avatar.jsx` renders either the chosen preset image or the monogram (first letter on a brass plate). Used by both the header chip and the settings modal. The username and profile image are mirrored from the Firestore user doc into the Zustand store (`username`, `profileImage`) so the UI updates live.
- **Background audio** (`src/components/BackgroundAudio.jsx`): Quiet, gapless music (intro then seamless loop); mute state persists in `localStorage`.

## Data Structure
- `public/places.json`: Contains the 91 locations mentioned in Johnny Cash's "I've Been Everywhere". Includes coordinates and GeoJSON polygons (generated via Nominatim) to accurately render state/country boundaries.
- `src/ProfileImages/`: Drop square `.webp` images here to offer them as preset profile pictures. They are discovered at build time via `import.meta.glob` (`src/profileImages.js`) — no code change is needed, and the picker updates automatically as files are added/removed (Vite full-reloads in dev). The filename (minus extension) is the stable key persisted to `users/{uid}.profileImage`; lives under `src/` rather than `public/` so the bundler can glob it.
  - `src/ProfileImages/LIMITED/`: images here are flagged `limited: true` and are only offered in the picker to the protected owner account (username exactly `TrueProblematic`). Everyone else never sees them; limited options render with a gold "Limited" badge for the owner.
- **Firestore Schema** (implemented):
  - `users/{uid}`: Stores `username`, `visitedCount`, a `visitedPlaces` array, and an optional `profileImage` (preset key, or absent/`null` for the monogram).
  - `usernames/{username}`: Reserves a lowercased username and maps it to its `uid` (enforces unique usernames). Auth uses virtual emails of the form `username@ivebeensomewhere.tp`. Rules allow the owner to `create` and `delete` their reservation (delete is needed for renames and account deletion — see `firestore.rules`; **deploy the rules** with `firebase deploy --only firestore:rules` for username changes/deletion to fully work).

### Protected handle
`TrueProblematic` is a reserved handle (`src/reservedNames.js`). Sign-up (`AuthModal.jsx`) and rename (`UserSettingsModal.jsx`) both reject it and any look-alike — names are normalized (lowercased, leetspeak folded, punctuation stripped) and matched by substring containment plus a small edit-distance threshold, so variants like `Tru3_Problematic`, `xTrueProblematic`, or `TrueProblematicFan` are blocked. The exact name is also protected at the data layer by its existing `usernames/trueproblematic` doc (a `create` of an existing doc fails). Only the legitimate owner keeps the exact handle; this gating is client-side (fuzzy matching can't be expressed in Firestore rules).

### Profanity / hate-speech filter
`src/profanityFilter.js` screens a username for profanity or hate speech via a normalized substring blocklist (`screenUsername` / `isProfaneUsername`). Normalization folds leetspeak, strips punctuation, and squeezes repeated letters; an allowlist suppresses common false positives (e.g. "japan", "scunthorpe", "classmate"). Hate-speech terms are base64-encoded in source so the file isn't a plaintext slur dump. **Note:** this module is not yet wired into `AuthModal.jsx` / `UserSettingsModal.jsx` — it's currently exercised only by the local test harness below.

### Local username test harness
`localTests/testUsernames.sh` (the `localTests/` folder is gitignored) runs both `reservedNames.js` and `profanityFilter.js` against names you pass as arguments, pipe in, or type interactively, printing `ALLOWED` / `BLOCKED` with the reason. Handy for sanity-checking the guards.

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
