import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// Replace these with actual values from the Firebase Console before production
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

let app, db, auth;

if (!isTestMode) {
  // Initialize real Firebase
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
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
}

export { db, auth, isTestMode };
