# I've Been Somewhere

An interactive web application themed around Johnny Cash's famous song "I've Been Everywhere".
Track all 92 locations mentioned in the song, view them on an interactive map, and see how you stack up against other fans on the global leaderboard!

Live: https://ivebeensomewhere-tp.web.app

## Features
- **Interactive Map**: OpenStreetMap tiles, tinted to look like a worn road atlas, showing cities as pins and states/countries as highlighted polygons, with a fullscreen view. Visited places glow gold; unvisited places are dimmed to near-monochrome so your progress stands out. On phones the inline map doesn't swallow your swipe — go fullscreen to pan it.
- **List View**: Chronological list of everywhere Cash has been.
- **Dynamic Leaderboard**: Global leaderboard tracking percentage of places visited.
- **Accounts**: Secure account creation to track your personal journey. Your user icon opens a settings menu where you can change your username, pick a profile picture, change your password, log out, or delete your account.
- **Password reset by identity quiz**: Forgot your password? After a wrong attempt a "Forgot Password?" option appears. Instead of an email (accounts use synthetic logins), you prove it's really you by sorting 10 of the 92 song locations into places you *have* and *haven't* been. All grading and the actual password change happen on a trusted backend — the browser never sees the answers. See `localTests/SECURITY_REPORT.md` for the full security write-up.
- **Profile pictures**: Choose from preset avatars (drop square `.webp` files into `src/ProfileImages/` — they appear as options automatically) or keep your monogram.
- **Background Audio**: Optional, mutable vintage soundtrack.

## Tech Stack
React + Vite, Tailwind CSS, React-Leaflet, Zustand, and Firebase (Auth + Firestore + **Cloud Functions**), hosted on Firebase Hosting. The password-reset backend requires the Firebase **Blaze** plan.

## Tests
```bash
npm test   # password-reset unit + attack-vector suite, and the visited-list sync guards
```

## Admin: repairing a visited list
`functions/scripts/restoreVisited.js` inspects and repairs a user's places with Admin credentials. Every write rewrites the private list and the public `visitedCount` in one transaction, so the leaderboard can't drift from the list.
```bash
node functions/scripts/restoreVisited.js --show TrueProblematic
node functions/scripts/restoreVisited.js --set TrueProblematic --names "Reno,Chicago" --dry-run
node functions/scripts/restoreVisited.js --reconcile
```

## Local Setup
Ensure you have `npm` and `node` installed.
To run the local test mode (with mocked authentication and backend):
```bash
./run_local.sh
```

To check the real production bundle instead:
```bash
npm run build && npm run preview
```

## Adding a place
`public/places.json` is the source of truth: the array is in the order the song sings them, and each entry's `id` is the permanent key stored in every user's visited list — never renumber existing ids. After editing it, regenerate `functions/places.slim.json`, bump `TOTAL_PLACES` in `functions/src/resetLogic.js` and `ALL_IDS` in `src/mockResetBackend.js`, and add the place to the crawler-only checklist in `index.html`. Write `places.json` **minified** (no indent) — pretty-printed it triples in size and every visitor downloads it.

## Deployment
Hosted on Firebase Hosting (project `ivebeensomewhere-tp`, on the **Blaze** plan for Cloud Functions). To deploy (only when approved):
```bash
npm run build
npm --prefix functions install
firebase deploy --only hosting,functions,firestore:rules --project ivebeensomewhere-tp
```

## License
This project is licensed under the GPLv3 License. See the LICENSE file for details.
