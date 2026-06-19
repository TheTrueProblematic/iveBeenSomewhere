import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Public reCAPTCHA v3 site key for App Check (safe to ship — like the apiKey).
// Attests that calls come from the real app; gates the reset Cloud Functions.
const RECAPTCHA_SITE_KEY = "6Lf7DSctAAAAAD9nIvJxQciUMoHYgh9mmCqhthKX";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMAZy3wFgvSPphhKudp6vWIRxUD32wtWE",
  authDomain: "ivebeensomewhere-tp.firebaseapp.com",
  projectId: "ivebeensomewhere-tp",
  storageBucket: "ivebeensomewhere-tp.firebasestorage.app",
  messagingSenderId: "510564565368",
  appId: "1:510564565368:web:d63cc79464f3c3333fc88d"
};

const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
// Point the SDK at the local emulator suite (real Firebase code paths, no cloud).
// Used for end-to-end testing of the Cloud Functions + Firestore rules.
const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

let app, db, auth, functions;

if (!isTestMode) {
  // Initialize real Firebase
  app = initializeApp(firebaseConfig);

  // App Check (reCAPTCHA v3) — initialize early so a token is attached to the
  // reset Cloud Function calls. Skipped against the emulator (no provider there).
  if (!useEmulator) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefresh: true,
      });
    } catch (err) {
      console.error('App Check init failed:', err);
    }
  }

  db = getFirestore(app);
  auth = getAuth(app);
  functions = getFunctions(app);

  if (useEmulator) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.warn('Firebase connected to LOCAL EMULATORS.');
  }
} else {
  console.warn("Running in TEST MODE. Firebase is mocked.");
  // Mock implementations for local testing
  db = {
    _isMock: true,
  };
  auth = {
    _isMock: true,
    currentUser: {
      uid: "test-user-123",
      displayName: "Johnny Cash Fan"
    }
  };
  functions = { _isMock: true };
}

export { db, auth, functions, isTestMode };
