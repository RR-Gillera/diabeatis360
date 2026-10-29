// Which screens each role may open (QA D-15). Only the first part of the address matters ("doctor" in /doctor/patient/1).
// Sign-in, setup, the consultation chat and summary, video calls, Language and the legal pages are shared by both roles.
// This only steers people to their own screens; what anyone may read or write is enforced by firestore.rules either way.
// No imports, so plain Node tests it (route-rules.test.mjs).
export type GuardRole = 'guest' | 'user' | 'doctor';

/** Screens only a signed-in patient uses. Doctors have their own Home, notifications and profile under /doctor. */
export const PATIENT_ONLY = [
  'user-home', 'glucose-log', 'glucose-result', 'booking', 'scanner', 'meal-suggestions', 'meal-details', 'exercise-tips',
  'exercise-details', 'healthier-alternatives', 'rewards', 'subscription', 'profile', 'health-profile', 'dietary-preference',
  'notification-settings', 'notifications',
] as const;

/** Where to send someone who opened an address starting with `first`, or null to let them stay. */
export function redirectFor(first: string | undefined, role: GuardRole): string | null {
  if (!first) return null;
  if (first === 'doctor') return role === 'doctor' ? null : role === 'user' ? '/user-home' : '/';
  if ((PATIENT_ONLY as readonly string[]).includes(first)) return role === 'doctor' ? '/doctor' : role === 'guest' ? '/' : null;
  return null;
}
