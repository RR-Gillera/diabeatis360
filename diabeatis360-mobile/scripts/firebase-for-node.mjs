// Stands in for src/firebase.js when the app's service files run under plain Node in a test: the same Firebase client
// libraries, pointed at the Firebase EMULATORS. It refuses to run without them, so a test can never reach a real project.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('firebase-for-node.mjs only works against the emulators: run inside "firebase emulators:exec --only auth,firestore".');
}

export const app = initializeApp({ apiKey: 'fake-key', projectId: 'demo-diabeatis360' }, 'service-test');
export const db = getFirestore(app);
export const auth = getAuth(app);
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
