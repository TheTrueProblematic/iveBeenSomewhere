# I've Been Somewhere

An interactive web application themed around Johnny Cash's famous song "I've Been Everywhere".
Track all 91 locations mentioned in the song, view them on an interactive map, and see how you stack up against other fans on the global leaderboard!

Live: https://ivebeensomewhere-tp.web.app

## Features
- **Interactive Map**: Shows cities as pins and states/countries as highlighted polygons, with a fullscreen view. Visited places glow gold; unvisited places are dimmed to near-monochrome so your progress stands out.
- **List View**: Chronological list of everywhere Cash has been.
- **Dynamic Leaderboard**: Global leaderboard tracking percentage of places visited.
- **Accounts**: Secure account creation to track your personal journey. Your user icon opens a settings menu (currently holding Log Out).
- **Background Audio**: Optional, mutable vintage soundtrack.

## Tech Stack
React + Vite, Tailwind CSS, React-Leaflet, Zustand, and Firebase (Auth + Firestore), hosted on Firebase Hosting.

## Local Setup
Ensure you have `npm` and `node` installed.
To run the local test mode (with mocked authentication and backend):
```bash
./run_local.sh
```

## Deployment
Hosted on Firebase Hosting (project `ivebeensomewhere-tp`). To deploy (only when approved):
```bash
npm run build
firebase deploy --only hosting --project ivebeensomewhere-tp
```

## License
This project is licensed under the GPLv3 License. See the LICENSE file for details.
