import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

import { auth } from '@/firebase';
import { getSocialToken } from '@/features/auth/social-login';
import { credentialFor } from '@/features/auth/social-service';
import type { SocialProvider } from '@/features/auth/social-types';

import { confirmMethods, type ConfirmMethods } from './pin-reset-rules';

// "Forgot PIN?" (DECISIONS.md D56): before a new PIN may be made, the person proves they own the account by signing in
// to it again. Firebase calls this reauthentication. It checks the proof against the account that is ALREADY signed in,
// so it cannot switch to another account, and it changes nothing in Firestore. No email or code is sent by us:
//   email accounts    type their Diabeatis360 password (Firebase checks it);
//   Google/Facebook   go through Google's or Facebook's own login again (social-login.ts), and Firebase checks that the
//                     answer is for this same account.

function signedInUser() {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/user-token-expired' });
  return user;
}

/** The ways the signed-in account can confirm who it is. */
export function currentConfirmMethods(): ConfirmMethods {
  return confirmMethods(auth.currentUser?.providerData.map((info) => info.providerId) ?? []);
}

/** Checks the account's password. Throws the Firebase error (wrong password, offline, too many tries). */
export async function confirmWithPassword(password: string): Promise<void> {
  const user = signedInUser();
  if (!user.email) throw Object.assign(new Error('No email'), { code: 'auth/invalid-credential' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

/**
 * Opens Google's or Facebook's login, then checks the answer belongs to this account. Throws SocialLoginError (closed,
 * not in this build, ...) or the Firebase error: auth/user-mismatch when another Google/Facebook account was used.
 */
export async function confirmWithProvider(provider: SocialProvider): Promise<void> {
  const user = signedInUser();
  const token = await getSocialToken(provider);
  await reauthenticateWithCredential(user, credentialFor(token));
}
