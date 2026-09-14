import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

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

export async function hasCompletedOnboarding(email: string) {
  return (await AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`)) === 'complete';
}

export async function completeOnboarding(email: string, profileType: 'patient' | 'doctor') {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`, 'complete');
  await AsyncStorage.setItem(`diabeatis360:profile:${email.trim().toLowerCase()}`, profileType);
}

export async function saveOnboardingValue(email: string, key: string, value: string, uid?: string | null) {
  await AsyncStorage.setItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`, value);

  const field = firestoreFields[key];
  if (!uid || !field) return;
  // birthdate is a DATE in the ERD, so it goes in as a Timestamp when the
  // "January 5, 2000" string the picker produces parses cleanly.
  let stored: string | Timestamp = value;
  if (field === 'birthdate') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) stored = Timestamp.fromDate(parsed);
  }
  await setDoc(doc(db, 'Users', uid), { [field]: stored }, { merge: true });
}

export async function getOnboardingValue(email: string, key: string) {
  return AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}:${key}`);
}
