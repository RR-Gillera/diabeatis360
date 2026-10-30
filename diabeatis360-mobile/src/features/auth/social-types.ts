// What the Google and Facebook sign-in buttons share (DECISIONS.md D23). No Firebase or React imports, so plain Node can
// test it (social-types.test.mjs). The three jobs are split across files:
//   social-login.ts    asks Google or Facebook who the person is (native code, phone only)
//   social-service.ts  gives that answer to Firebase and applies our rules to it
//   auth-context.tsx   turns the Firebase login into the app's session, like any other login

import { translate, type Language } from '@/i18n/translate';

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
export function socialErrorMessage(value: unknown, provider: SocialProvider, language: Language = 'English') {
  const name = providerName(provider);
  const say = (key: Parameters<typeof translate>[1]) => translate(language, key, { name });

  if (value instanceof SocialLoginError) {
    switch (value.failure) {
      case 'cancelled':
        return '';
      case 'unavailable':
        return say('social.unavailable');
      case 'not-configured':
        return say('social.notConfigured');
      case 'play-services':
        return say('social.playServices');
      case 'no-email':
        return say('social.noEmail');
      default:
        return say('social.failed');
    }
  }

  switch (codeOf(value)) {
    case 'auth/account-exists-with-different-credential':
    case 'auth/email-already-in-use':
      return say('social.otherMethod');
    case 'auth/network-request-failed':
      return say('verify.error.offline');
    case 'auth/user-disabled':
    case 'app/account-deactivated':
      return say('auth.error.deactivated');
    case 'auth/operation-not-allowed':
      return say('social.notEnabled');
    case 'auth/too-many-requests':
      return say('auth.error.tooMany');
    default:
      return say('social.failed');
  }
}
