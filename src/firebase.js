import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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
