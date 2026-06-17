# AGENTS Documentation

## Project Architecture
This project is built using:
- **React + Vite**: For a fast, modern frontend development experience.
- **Tailwind CSS**: For responsive, atomic styling and utility classes.
- **React-Leaflet / Leaflet**: For the interactive map component, allowing for both city markers and state/country polygons.
- **Zustand**: For lightweight, centralized state management (specifically the `visitedPlaces` store).
- **Firebase**: Used for Authentication (hashing/storing passwords) and Firestore (storing user visited lists and the global leaderboard).

## Data Structure
- `public/places.json`: Contains the 92 locations mentioned in Johnny Cash's "I've Been Everywhere". It includes coordinates and GeoJSON polygons generated via Nominatim to accurately render state/country boundaries.
- **Firestore Schema (Planned)**:
  - `users/{uid}`: Stores `username`, `visitedCount`, and `visitedPlaces` array.

## Local Testing
To test the application locally without full Firebase setup:
1. Run `./run_local.sh`
2. This runs the app in `VITE_TEST_MODE=true`, which uses mock Firebase authentication (auto-logging in as a test user) and mock data for the leaderboard and Firestore.

## Deployment
Do NOT deploy to Google Cloud/Firebase Hosting until EXPLICITLY approved by the user. Once approved, the steps are:
1. Initialize Firebase Hosting using `npx firebase-tools init hosting`.
2. Build the app using `npm run build`.
3. Deploy using `npx firebase-tools deploy --only hosting`.
