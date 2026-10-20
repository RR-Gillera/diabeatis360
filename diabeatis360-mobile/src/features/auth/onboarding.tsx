import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

import { birthdateToTimestamp } from './birthdate';
import { allergiesDeclared, birthdateText } from './health-profile';
import { firstUnansweredStep } from './onboarding-steps';

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
  // 'self' or 'minor' (DECISIONS.md D16) — already the lowercase code the rules and enums.ts expect.
  accountType: 'account_type',
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

      // A doctor an admin added (Add Provider) never runs onboarding; their Providers record is the proof.
      // There is no other shortcut any more: "has a birthdate or a diabetes type" used to count as finished, so a
      // person who stopped at the Allergies step was never asked about allergies (DECISIONS.md D25).
      if (data?.role === 'doctor') {
        const provider = await getDoc(doc(db, 'Providers', uid));
        if (provider.exists()) return true;
      }
    } catch {
      // Offline or permission trouble — fall through to the local flag rather
      // than locking a legitimate user out of their own account.
    }
  }
  return (await AsyncStorage.getItem(`diabeatis360:onboarding:${email.trim().toLowerCase()}`)) === 'complete';
}

/**
 * The onboarding screen to open for someone who has not finished: the first question without an answer, read from
 * the Users document first and this phone's copy second (DECISIONS.md D25).
 */
export async function onboardingStartPath(email: string, uid?: string | null) {
  const local = async (key: string) => (await getOnboardingValue(email, key)) ?? '';
  let data: Record<string, unknown> = {};
  let guardianSubmitted = false;
  if (uid) {
    try {
      data = (await getDoc(doc(db, 'Users', uid))).data() ?? {};
      if (data.account_type === 'minor') guardianSubmitted = (await getDoc(doc(db, 'Guardian_Verifications', uid))).exists();
    } catch { /* offline: this phone's answers below */ }
  }
  return firstUnansweredStep({
    language: String(data.language_preference ?? '') || await local('language'),
    profileType: String(data.role ?? '') || await local('profileType'),
    accountType: String(data.account_type ?? '') || await local('accountType'),
    guardianSubmitted,
    dateOfBirth: birthdateText(data.birthdate) || await local('dateOfBirth'),
    condition: String(data.diabetes_type ?? '') || await local('condition'),
    allergy: String(data.allergies ?? '') || await local('allergy'),
    activity: String(data.activity_level ?? '') || await local('activity'),
    diet: String(data.dietary_preference ?? '') || await local('diet'),
  });
}

/** Thrown by completeOnboarding when a patient has not answered the allergy question; the screen sends them back to it. */
export const ALLERGIES_MISSING = 'onboarding/allergies-missing';

export async function completeOnboarding(email: string, profileType: 'patient' | 'doctor', uid?: string | null) {
  // A patient cannot finish without answering the allergy question ("None" counts): AI suggestions depend on it.
  if (profileType === 'patient') {
    let stored: unknown = await getOnboardingValue(email, 'allergy');
    if (uid && !allergiesDeclared(stored)) {
      try { stored = (await getDoc(doc(db, 'Users', uid))).data()?.allergies; } catch { /* keep the local answer */ }
    }
    if (!allergiesDeclared(stored)) throw new Error(ALLERGIES_MISSING);
  }
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
