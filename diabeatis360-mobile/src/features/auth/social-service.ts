// Gives the proof from Google or Facebook (social-login.ts) to Firebase, and applies our own rules to the result
// (DECISIONS.md D23). It lives in a plain .ts file, apart from the React context, so a test can run it against the
// Firebase emulator (social-service.emulator.test.mjs).
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  getAdditionalUserInfo,
  sendEmailVerification,
  signInWithCredential,
  signOut,
  type User,
} from 'firebase/auth';

import { auth } from '@/firebase';
import { SocialLoginError, type SocialToken } from './social-types';

export type SocialSignIn = {
  user: User;
  /** First time this Google/Facebook account has been used here: Firebase has just created the login. */
  isNewUser: boolean;
  /**
   * Only set when a brand-new account's email is not confirmed yet: true if the verification email went out, false if
   * it could not be sent (the "Check your email" screen then offers Resend). null when no email was due.
   */
  verificationEmailSent: boolean | null;
};

function credentialFor({ provider, token }: SocialToken) {
  return provider === 'google' ? GoogleAuthProvider.credential(token) : FacebookAuthProvider.credential(token);
}

/**
 * Signs in to Firebase with a Google ID token or a Facebook access token. Firebase creates the login the first time.
 * Throws SocialLoginError('no-email') for an account without an email address, and leaves nobody signed in.
 */
export async function signInWithSocialToken(social: SocialToken): Promise<SocialSignIn> {
  const result = await signInWithCredential(auth, credentialFor(social));
  const user = result.user;
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;

  // Every account is confirmed by email (D21) and reached by email (reminders, receipts), so one without an address is
  // refused. This happens with a Facebook account that signed up with a phone number, or when the person declined to
  // share their email. A login Firebase has just created for them is removed again, so nothing is left behind.
  if (!user.email) {
    if (isNewUser) {
      try {
        await deleteUser(user);
      } catch {
        await signOut(auth);
      }
    } else {
      await signOut(auth);
    }
    throw new SocialLoginError('no-email');
  }

  // Google vouches for its emails, so a Google login is confirmed already. Facebook's are not trusted by Firebase, so a
  // new Facebook account gets the same "tap the link" email as an email sign-up. A returning person is not mailed again
  // (like a normal login): the screen has a Resend button.
  let verificationEmailSent: boolean | null = null;
  if (!user.emailVerified && isNewUser) {
    try {
      await sendEmailVerification(user);
      verificationEmailSent = true;
    } catch {
      verificationEmailSent = false;
    }
  }
  return { user, isNewUser, verificationEmailSent };
}
