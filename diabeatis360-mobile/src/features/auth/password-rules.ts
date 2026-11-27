import { PASSWORD_MIN_LENGTH } from '@/constants/account';
import type { MessageKey } from '@/i18n/en';

// The checks of the doctor's Change Password screen (DECISIONS.md D55 part 3). Kept apart from Firebase so they can be
// unit-tested (password-rules.test.mjs). Firebase itself checks the current password and stores the new one: the app
// never saves or sends a password anywhere else.

/** What is wrong with the typed passwords before anything is sent to Firebase, or null when they can be sent. */
export function newPasswordProblem(current: string, next: string, confirm: string): MessageKey | null {
  if (!current || !next || !confirm) return 'auth.error.required';
  if (next.length < PASSWORD_MIN_LENGTH) return 'auth.error.passwordShort';
  if (next !== confirm) return 'auth.error.passwordsDiffer';
  if (next === current) return 'password.change.same';
  return null;
}

/** The message for a failed change, from the Firebase error code. A wrong current password is the usual one. */
export function changePasswordErrorKey(error: unknown): MessageKey {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'password.change.wrongCurrent';
  if (code === 'auth/too-many-requests') return 'auth.error.tooMany';
  if (code === 'auth/weak-password') return 'auth.error.weakPassword';
  return 'password.change.failed';
}
