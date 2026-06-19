# AGENTS Documentation

## Maintenance Policy (READ FIRST)
**Whenever you make a change to this project, you MUST keep `AGENTS.md` and `README.md` up to date in the same change.** If you add, remove, or alter a feature, a build/run/deploy step, the data model, or the tech stack, update both documents to match before considering the task complete. Treat these docs as part of the deliverable, not an afterthought.

## Project Architecture
This project is built using:
- **React + Vite**: For a fast, modern frontend development experience.
- **Tailwind CSS**: For responsive, atomic styling and utility classes. The visual theme is a vintage "Man in Black" / worn road-atlas aesthetic. Use Lucide icons or text — **no emojis** in the UI.
- **React-Leaflet / Leaflet**: For the interactive map component, allowing for both city markers and state/country polygons.
- **Zustand**: For lightweight, centralized state management (the `visitedPlaces` store plus `user`, modal, and audio state in `src/store.js`).
- **Firebase**: Used for Authentication (username + password via virtual emails), Firestore (storing user visited lists and the global leaderboard), and **Cloud Functions** (the trusted backend for the password-reset identity quiz — see Password Reset below). Cloud Functions require the project to be on the **Blaze** plan (free tier covers this scale).

## Features
- **Interactive Map** (`src/components/MapTracker.jsx`): Cities render as pins, states/countries as GeoJSON polygons. Includes:
  - A **fullscreen toggle** (uses the native Fullscreen API; calls Leaflet's `invalidateSize()` on `fullscreenchange` so the map reflows).
  - **Visited vs. unvisited styling**: visited pins are larger and carry a pulsing gold glow; unvisited pins are heavily desaturated (near-monochrome) so visited places stand out. Pin filters live in `src/index.css` (`.visited-pin` / `.unvisited-pin`).
- **List View** (`src/components/ListTracker.jsx`): Chronological list of every place in the song.
- **Leaderboard** (`src/components/Leaderboard.jsx`): Global leaderboard tracking percentage of places visited, read from the Firestore `users` collection. Each entry shows the traveler's `Avatar` (their chosen `profileImage` or the monogram fallback) alongside their rank, name, and progress bar.
- **Password Reset** (identity quiz): on the sign-in screen, after a wrong password on an *existing* account, a **"Forgot Password?"** option fades in (`animate-fade-in-up`); after 5 wrong attempts the user is pushed straight into it. The reset flow (`src/components/PasswordResetFlow.jsx`) proves identity with a **10-place "Been / Haven't Been" sorting quiz** drawn from the 91 song locations, then lets the user set a new password. **All security is server-side** (Cloud Functions); the browser only ever receives place names to sort. Eligibility: must have visited 5–86 places. Set composition: 5–10 → 2 visited tiles, 11–79 → 3–7, 80–86 → 8. Three attempts per cycle (each a fresh non-replayable set; reloading resumes the same set); after 3 failures the account is hidden from the leaderboard until a successful normal sign-in. A successful reset resets the budget to 3. See **Backend** and **Security** below, and `localTests/SECURITY_REPORT.md`.
- **Accounts**: Sign in / sign up via `AuthModal.jsx`. The signed-in user's chip in the header opens a **User Settings modal** (`src/components/UserSettingsModal.jsx`). The modal is a single component with several panels (a `view` state machine):
  - **Profile header**: the avatar and username sit at the top. Clicking the username opens an inline rename; clicking the avatar opens the profile-picture picker.
  - **Change username**: updates the Firebase Auth display name *and* login email (the username is the login identity via the virtual email), reserves the new `usernames/{name}` doc, releases the old one, and updates `users/{uid}.username`.
  - **Profile picture**: a scrollable grid of preset avatars plus the monogram fallback. Options come from `src/ProfileImages/` (see Data Structure). The chosen key is saved to `users/{uid}.profileImage`.
  - **Change password**: re-authenticates with the current password, then sets the new one (entered twice to confirm).
  - **Delete account**: requires the password to confirm (which also re-authenticates), then removes **all** Firestore data (the private `visited` subdoc, the public `users/{uid}` doc, and the `usernames` reservation) and finally the Auth user. **Important:** it sets the store's `deletingAccount` flag first — otherwise the `onAuthStateChanged` snapshot listener in `src/store.js` would see the public doc vanish and immediately re-create it (the user isn't signed out until `deleteUser` resolves), leaving an orphaned 0% entry on the leaderboard. An orphan is identifiable as a `users` doc with no matching `usernames/{lowercased}` reservation.
- **Avatars**: `src/components/Avatar.jsx` renders either the chosen preset image or the monogram (first letter on a brass plate). Used by both the header chip and the settings modal. The username and profile image are mirrored from the Firestore user doc into the Zustand store (`username`, `profileImage`) so the UI updates live.
- **Background audio** (`src/components/BackgroundAudio.jsx`): Quiet, gapless music (intro then seamless loop); mute state persists in `localStorage`.

## Data Structure
- `public/places.json`: Contains the 91 locations mentioned in Johnny Cash's "I've Been Everywhere". Includes coordinates and GeoJSON polygons (generated via Nominatim) to accurately render state/country boundaries.
- `src/ProfileImages/`: Drop square `.webp` images here to offer them as preset profile pictures. They are discovered at build time via `import.meta.glob` (`src/profileImages.js`) — no code change is needed, and the picker updates automatically as files are added/removed (Vite full-reloads in dev). The filename (minus extension) is the stable key persisted to `users/{uid}.profileImage`; lives under `src/` rather than `public/` so the bundler can glob it.
  - `src/ProfileImages/LIMITED/`: images here are flagged `limited: true` and are only offered in the picker to the protected owner account (username exactly `TrueProblematic`). Everyone else never sees them; limited options render with a gold "Limited" badge for the owner.
- **Firestore Schema** (implemented):
  - `users/{uid}` (**public read**): Stores `username`, `visitedCount`, an optional `profileImage` (preset key, or absent/`null` for the monogram), and `leaderboardHidden` (set true when an account fails the reset quiz 3×). **The visited LIST is no longer here** — Firestore can't restrict reads per-field, so it moved to the private subdoc below to keep it from being world-readable (which would let anyone ace the reset quiz).
  - `users/{uid}/private/visited` (**owner-only**): `{ visitedPlaces: [...] }`. The trusted backend reads it with the Admin SDK to grade the reset quiz. Legacy data on the public doc is moved here by a lazy client migration (`src/store.js`) and the one-shot `functions/scripts/migrateVisited.js`.
  - `resetSessions/{uid}` (Admin SDK only, with one exception): per-user reset state — the challenge answer key, attempt counter, lockout flag, and the one-time reset token. Clients may **not** read/create/update it (so the answer key and counts stay secret and tamper-proof), but a **signed-in user may DELETE their own** session — that is the "sign in to unlock" path (a successful login clears the lockout + attempt budget with a direct Firestore delete, no Cloud Function needed). An attacker mid-reset is unauthenticated, so cannot delete.
  - `usernames/{username}`: Reserves a lowercased username and maps it to its `uid` (enforces unique usernames). Auth uses virtual emails of the form `username@ivebeensomewhere.tp`. Rules allow the owner to `create` and `delete` their reservation (delete is needed for renames and account deletion — see `firestore.rules`; **deploy the rules** with `firebase deploy --only firestore:rules` for username changes/deletion to fully work).

### Backend (Cloud Functions) — `functions/`
The trusted backend for the password reset. The browser is treated as hostile: every gate (eligibility, grading, the 3-attempt budget, the actual password write) is enforced here, never on the client. Files:
- `functions/index.js`: **only** the `onCall` wrappers. It must export nothing but CloudFunction objects: the firebase-functions deploy analyzer recurses into every export, and a Firestore/Auth instance there overflows its stack. The active callables are `requestPasswordResetChallenge`, `submitPasswordResetChallenge`, `completePasswordReset`. `clearResetStateOnLogin` is **deprecated/unused** — the unlock is now a direct client-side `deleteDoc(resetSessions/{uid})` on login (more robust; it also avoided a Cloud Run invoker-binding issue that left that one function returning 403). It's still defined/deployed but nothing calls it.
- **Deploy gotcha:** a 2nd-gen callable needs the public Cloud Run invoker binding (`allUsers` → `roles/run.invoker`), which Firebase only sets on a *successful initial* create. If a function's first deploy fails the build and only succeeds on a later `--force` update, it can end up deployed-but-not-invokable (every call → Cloud Run 403 before the function runs). `npm run test:smoke` catches this.
- `functions/src/handlers.js`: the Firestore/Admin **adapter** (`process*` functions) — reads the private visited list, persists session state, sets the password via `auth.updateUser`, hides/restores the leaderboard entry. **Note:** `saveSession` does a full `set()` (NOT `{ merge: true }`) — Firestore recursively merges nested maps, which would let `pending.answerKey` accumulate keys across challenges and make every submission grade as "wrong".
- `functions/src/resetLogic.js` + `functions/src/resetSession.js`: the **pure, dependency-free** decision logic and session state machine (the single source of truth the tests import — no Firebase needed).
- `functions/places.slim.json`: the 91 places with only `id`/`name`/`type`/`desc` (no GeoJSON), used to compose challenges. Regenerate from `public/places.json` if places change.
- **App Check (reCAPTCHA v3)** is enabled: the public site key lives in `src/firebase.js` (`initializeAppCheck`), and the functions enforce it via `enforceAppCheck` gated on `ENFORCE_APP_CHECK`. Enforcement is turned on for production in `functions/.env` (`ENFORCE_APP_CHECK=true`) and turned off for the local emulator in `functions/.env.local` (so `firebase emulators:start` still works without an App Check token). Both `.env` files are gitignored; recreate them when deploying from a fresh clone. The reCAPTCHA site is registered for the `web.app`/`firebaseapp.com` domains (+ `localhost`).

### Security
The whole reset process is hardened against the documented attack vectors (inspect-element/answer-peeking, step-skipping, input overflow/injection, infinite attempts, and direct DB reads of who's been where). The rationale, the trust boundary, and the test that proves each defense are written up in **`localTests/SECURITY_REPORT.md`**. Client-side files (`src/passwordResetClient.js`, `src/mockResetBackend.js`) are deliberately just messengers/mocks and hold no secrets.

### Protected handle
`TrueProblematic` is a reserved handle (`src/reservedNames.js`). Sign-up (`AuthModal.jsx`) and rename (`UserSettingsModal.jsx`) both reject it and any look-alike — names are normalized (lowercased, leetspeak folded, punctuation stripped) and matched by substring containment plus a small edit-distance threshold, so variants like `Tru3_Problematic`, `xTrueProblematic`, or `TrueProblematicFan` are blocked. The exact name is also protected at the data layer by its existing `usernames/trueproblematic` doc (a `create` of an existing doc fails). Only the legitimate owner keeps the exact handle; this gating is client-side (fuzzy matching can't be expressed in Firestore rules).

### Profanity / hate-speech filter
`src/profanityFilter.js` screens a username for profanity or hate speech via a normalized substring blocklist (`screenUsername` / `isProfaneUsername`). Normalization folds leetspeak, strips punctuation, and squeezes repeated letters; an allowlist suppresses common false positives (e.g. "japan", "scunthorpe", "classmate"). Hate-speech terms are base64-encoded in source so the file isn't a plaintext slur dump. **Note:** this module is not yet wired into `AuthModal.jsx` / `UserSettingsModal.jsx` — it's currently exercised only by the local test harness below.

### Local username test harness
`localTests/testUsernames.sh` (the `localTests/` folder is gitignored) runs both `reservedNames.js` and `profanityFilter.js` against names you pass as arguments, pipe in, or type interactively, printing `ALLOWED` / `BLOCKED` with the reason. Handy for sanity-checking the guards.

## Local Testing
To test the application locally without full Firebase setup:
1. Run `./run_local.sh`.
2. This runs the app with `VITE_TEST_MODE=true`, which uses mock Firebase authentication (auto-logging in as a test user) and mock data for the leaderboard and Firestore. The reset flow is backed by `src/mockResetBackend.js` in this mode (the mock user "has been" to place ids 0–39, so mark tiles with id < 40 as "Been" to pass; password `letmein` signs in).

### Reset-flow tests + security suite
- `npm test` runs the Vitest suite in `localTests/passwordReset/` (`resetLogic.test.js` + `attackVectors.test.js`) — 34 unit and attack-vector tests against the real shipped logic in `functions/src/`. `npm run test:watch` for watch mode.
- `npm run test:integration` runs `localTests/passwordReset/integration.emulator.mjs` against the **Firestore + Auth emulators** (via `firebase emulators:exec`; needs Java). This exercises real Firestore persistence end-to-end — the only way to catch storage bugs the pure tests can't see (e.g. the `set({merge:true})` answer-key corruption). It seeds users and drives the full request → grade → reset / lockout / eligibility / reload paths, including the login-deletes-session unlock.
- `npm run test:rules` runs `localTests/passwordReset/rules.test.mjs` (Firestore emulator + `@firebase/rules-unit-testing`): proves `resetSessions` is unreadable/uneditable by clients, that only the owner can delete their own session, and that the private visited list is owner-only.
- `npm run test:smoke` runs `localTests/passwordReset/smoke.mjs` against the **deployed production functions** — POSTs to each callable and asserts it returns the callable JSON envelope (i.e. Cloud Run let the request reach the function) rather than a 403. Run after any functions deploy to catch the invoker-binding gotcha above.
- `localTests/SECURITY_REPORT.md` is the full threat-model write-up (one test per attack vector).
- **End-to-end with the emulator** (real functions + rules): `firebase emulators:start --only functions,firestore`, and point the web app at it with `VITE_USE_EMULATOR=true npm run dev`. Use this to confirm the Firestore rules actually deny client reads of `users/{uid}/private/visited` and `resetSessions/{uid}`.
- The `localTests/` folder is gitignored (local dev helpers only).

## Deployment
The app is hosted on **Firebase Hosting** (project `ivebeensomewhere-tp`). The password-reset Cloud Functions require the project to be on the **Blaze (pay-as-you-go) plan** — upgrade in the Firebase Console (can't be done via CLI; stays within the free tier at this scale). Only deploy when **explicitly approved by the user**. Once approved:
1. Build the app: `npm run build` (produces `dist/`; do NOT build in test mode for production).
2. Install function deps once: `npm --prefix functions install`.
3. Deploy: `firebase deploy --only hosting,functions,firestore:rules --project ivebeensomewhere-tp` (the rules change and the functions are both required for the reset flow to work).
4. App Check (reCAPTCHA v3) is already enabled (see Backend); `functions/.env` carries `ENFORCE_APP_CHECK=true`, so it deploys with the functions.
5. After first deploy, run the data migration once: `FIRESTORE_EMULATOR_HOST` unset, `GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> node functions/scripts/migrateVisited.js` (moves any legacy public visited lists into the private docs).
6. Live URL: https://ivebeensomewhere-tp.web.app

**Auth gotcha:** Email/Password sign-in must be enabled in the Firebase Console (Authentication → Sign-in method). It cannot be enabled via CLI/config on the free plan, and there is no Firebase CLI deploy target for auth providers.
