import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

import { birthdateToTimestamp } from './birthdate';

import { db } from '@/firebase';

// Onboarding answers are kept in AsyncStorage for the patient's own quick reads,
// AND mirrored onto their Users doc — without the Firestore copy a patient's
// health profile would be invisible to their doctor (and lost on reinstall),
// which is exactly what the doctor's "View Health Profile" module needs.
const firestoreFields: Record<string, string> = {
  dateOfBirth: 'birthdate',
  condition: 'diabetes_type',
  allergy: 'allergies',
  activity: 'activity_level',
  diet: 'dietary_preference',
  language: 'language_preference',
};

/**
 * Whether this account has finished onboarding.
 *
 * Firestore is the source of truth, not AsyncStorage: local storage is per
 * device (and per browser profile — a private window counts as a new one), so
 * a returning user on a new device would otherwise be marched through
 * onboarding all over again.
 */
export async function hasCompletedOnboarding(email: string, uid?: string | null) {
  if (uid) {
    try {
      const snapshot = await getDoc(doc(db, 'Users', uid));
      const data = snapshot.data();
      if (data?.onboarding_completed === true) return true;

      // Accounts that finished onboarding before this flag existed still need
      // to be recognised, so fall back to evidence that they went through it.
      if (data?.role === 'doctor') {
        const provider = await getDoc(doc(db, 'Providers', uid));
        if (provider.exists()) return true;
      }
      if (data?.birthdate || data?.diabetes_type || data?.activity_level || data?.dietary_preference) return true;
    } catch {
      // Offline or permission trouble — fall through to the local flag rather
      // than locking a legitimate user out of their own account.
    }
  }
  return (await AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`)) === 'complete';
}

export async function completeOnboarding(email: string, profileType: 'patient' | 'doctor', uid?: string | null) {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`, 'complete');
  await AsyncStorage.setItem(`diabeatis360:profile:${email.trim().toLowerCase()}`, profileType);
  if (!uid) return;
  // The durable copy — this is what lets the account skip onboarding on any
  // other device.
  await setDoc(doc(db, 'Users', uid), {
    onboarding_completed: true,
    role: profileType,
  }, { merge: true });
}

export async function saveOnboardingValue(email: string, key: string, value: string, uid?: string | null) {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`, value);

  const field = firestoreFields[key];
  if (!uid || !field) return;
  // birthdate is a DATE in the ERD, so it goes in as a Timestamp rather than
  // the raw picker string.
  let stored: string | Timestamp = value;
  if (field === 'birthdate') stored = birthdateToTimestamp(value) ?? value;
  await setDoc(doc(db, 'Users', uid), { [field]: stored }, { merge: true });
}

export async function getOnboardingValue(email: string, key: string) {
  return AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`);
}
