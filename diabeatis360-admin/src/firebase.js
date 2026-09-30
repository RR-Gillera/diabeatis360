import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

// Web config only (VITE_ variables are visible in the browser bundle). Never import firebase-admin or the
// service-account key here: those are for local Node scripts such as seed.cjs.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// Opt-in local testing: with VITE_USE_EMULATORS=true the panel talks to the Firebase emulators
// (firebase emulators:start) instead of the real project, so no real data is touched. Off by default.
if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

// Exported so services/provisionDoctor.js can open a second, throwaway Firebase app instance with the
// same project config (Add Provider creates the doctor's Auth login without replacing the admin's own
// session — see that file for why).
export { firebaseConfig }
