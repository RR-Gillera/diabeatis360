import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

import { auth } from '@/firebase';

// Change Password (DECISIONS.md D55 part 3). Firebase Authentication does the work: it checks the current password,
// then stores the new one. The app never keeps a password, and Firestore never sees one.

/**
 * True when this account logs in with an email and password. Someone who only uses Google or Facebook (D23) has no
 * password in Firebase, so there is nothing to change; the screen says so instead of showing the form.
 */
export function hasPasswordSignIn(): boolean {
  return auth.currentUser?.providerData.some((info) => info.providerId === 'password') ?? false;
}

/** "Google" or "Facebook" for an account without a password, for the screen's message. */
export function socialSignInName(): string {
  const ids = auth.currentUser?.providerData.map((info) => info.providerId) ?? [];
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('facebook.com')) return 'Facebook';
  return 'Google';
}

/**
 * Checks the current password, then saves the new one. Firebase asks for the current password again
 * (reauthentication) before it allows a password change, which also stops someone who picks up an unlocked phone.
 * Throws the Firebase error; the screen turns it into a message with changePasswordErrorKey().
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw Object.assign(new Error('Not signed in'), { code: 'auth/user-token-expired' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}
