# I've Been Somewhere

An interactive web application themed around Johnny Cash's famous song "I've Been Everywhere".
Track all 91 locations mentioned in the song, view them on an interactive map, and see how you stack up against other fans on the global leaderboard!

Live: https://ivebeensomewhere-tp.web.app

## Features
- **Interactive Map**: Shows cities as pins and states/countries as highlighted polygons, with a fullscreen view. Visited places glow gold; unvisited places are dimmed to near-monochrome so your progress stands out.
- **List View**: Chronological list of everywhere Cash has been.
- **Dynamic Leaderboard**: Global leaderboard tracking percentage of places visited.
- **Accounts**: Secure account creation to track your personal journey. Your user icon opens a settings menu where you can change your username, pick a profile picture, change your password, log out, or delete your account.
- **Password reset by identity quiz**: Forgot your password? After a wrong attempt a "Forgot Password?" option appears. Instead of an email (accounts use synthetic logins), you prove it's really you by sorting 10 of the 91 song locations into places you *have* and *haven't* been. All grading and the actual password change happen on a trusted backend — the browser never sees the answers. See `localTests/SECURITY_REPORT.md` for the full security write-up.
- **Profile pictures**: Choose from preset avatars (drop square `.webp` files into `src/ProfileImages/` — they appear as options automatically) or keep your monogram.
- **Background Audio**: Optional, mutable vintage soundtrack.

## Tech Stack
React + Vite, Tailwind CSS, React-Leaflet, Zustand, and Firebase (Auth + Firestore + **Cloud Functions**), hosted on Firebase Hosting. The password-reset backend requires the Firebase **Blaze** plan.

## Tests
```bash
npm test   # unit + attack-vector suite for the password-reset flow
```

## Local Setup
Ensure you have `npm` and `node` installed.
To run the local test mode (with mocked authentication and backend):
```bash
./run_local.sh
```

## Deployment
Hosted on Firebase Hosting (project `ivebeensomewhere-tp`, on the **Blaze** plan for Cloud Functions). To deploy (only when approved):
```bash
npm run build
npm --prefix functions install
firebase deploy --only hosting,functions,firestore:rules --project ivebeensomewhere-tp
```

## License
This project is licensed under the GPLv3 License. See the LICENSE file for details.
