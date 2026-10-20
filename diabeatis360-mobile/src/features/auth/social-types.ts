// What the Google and Facebook sign-in buttons share (DECISIONS.md D23). No imports on purpose, so plain Node can test it
// (social-types.test.mjs). The three jobs are split across files:
//   social-login.ts    asks Google or Facebook who the person is (native code, phone only)
//   social-service.ts  gives that answer to Firebase and applies our rules to it
//   auth-context.tsx   turns the Firebase login into the app's session, like any other login

export type SocialProvider = 'google' | 'facebook';

export function providerName(provider: SocialProvider) {
  return provider === 'google' ? 'Google' : 'Facebook';
}

/** What Google or Facebook hands back: proof of who the person is, which Firebase turns into a login. */
export type SocialToken = {
  provider: SocialProvider;
  /** Google: the ID token. Facebook: the access token. Passed to Firebase only; never stored or logged. */
  token: string;
};

/** Why a Google/Facebook sign-in stopped before Firebase finished it. */
export type SocialFailure =
  | 'cancelled' //      the person closed the Google/Facebook window: not an error, say nothing
  | 'unavailable' //    Expo Go or a web browser: the native sign-in code is not part of this app
  | 'not-configured' // this build has no Google/Facebook ID yet (docs/GO_LIVE.md A10)
  | 'play-services' //  Google Play services is missing or too old on the phone
  | 'no-email' //       Facebook gave no email address, and we confirm every account by email (D21)
  | 'failed'; //        anything else

export class SocialLoginError extends Error {
  failure: SocialFailure;

  constructor(failure: SocialFailure) {
    super(`Social sign-in stopped: ${failure}`);
    this.name = 'SocialLoginError';
    this.failure = failure;
  }
}

/** True when the person simply closed the Google/Facebook window. The screen shows nothing in that case. */
export function isCancelled(value: unknown) {
  return value instanceof SocialLoginError && value.failure === 'cancelled';
}

function codeOf(value: unknown) {
  return typeof value === 'object' && value && 'code' in value ? String((value as { code: unknown }).code) : undefined;
}

/** A plain-language reason for a failed Google/Facebook sign-in, from our own error or a Firebase error code. */
export function socialErrorMessage(value: unknown, provider: SocialProvider) {
  const name = providerName(provider);

  if (value instanceof SocialLoginError) {
    switch (value.failure) {
      case 'cancelled':
        return '';
      case 'unavailable':
        return `${name} sign-in works in the installed Diabeatis360 app. It is not available in Expo Go or a web browser.`;
      case 'not-configured':
        return `${name} sign-in is not set up in this version of the app yet. Please use your email and password for now.`;
      case 'play-services':
        return 'Google Play services is missing or out of date on this phone. Update it in the Play Store, then try again.';
      case 'no-email':
        return `${name} did not share an email address, and we need one to confirm your account. Add an email to your ${name} account, or sign up with your email and password.`;
      default:
        return `We could not sign you in with ${name}. Please try again.`;
    }
  }

  switch (codeOf(value)) {
    case 'auth/account-exists-with-different-credential':
    case 'auth/email-already-in-use':
      return 'This email already has a Diabeatis360 account that signs in another way. Log in with that one instead (your email and password, or the other button).';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your connection and try again.';
    case 'auth/user-disabled':
    case 'app/account-deactivated':
      return 'This account has been deactivated. Please contact support.';
    case 'auth/operation-not-allowed':
      return `${name} sign-in is not switched on for this project yet. Please use your email and password for now.`;
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return `We could not sign you in with ${name}. Please try again.`;
  }
}
