import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// The Cloud Functions that call Gemini (DECISIONS.md D1). Same region as Firestore.
export const functions = getFunctions(app, 'asia-southeast1');

// On native, plain getAuth(app) only persists the session in memory — closing the
// app signs the user out every time, silently, with just a console warning. Web
// gets persistence for free via the browser, so only native needs the explicit
// AsyncStorage-backed persistence layer.
export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// Opt-in local testing: with EXPO_PUBLIC_USE_EMULATORS=true the app talks to the Firebase emulators
// (firebase emulators:start) instead of the real project, so no real data is touched. Off by default.
// On a physical phone set EXPO_PUBLIC_EMULATOR_HOST to your computer's LAN IP instead of 127.0.0.1.
if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}
