// "Forgot PIN?": the rules of "Confirm it's you" (DECISIONS.md D56). No Firebase or React imports, so plain Node tests
// it (pin-reset-rules.test.mjs). The Firebase calls are in pin-reset-service.ts; the screen is pin-forgot.tsx.
import type { MessageKey } from '@/i18n/en';
import type { SocialProvider } from '@/features/auth/social-types';

/** How this account can prove who it is: its password, and/or the Google or Facebook account it is linked to. */
export type ConfirmMethods = { password: boolean; social: SocialProvider[] };

/**
 * Turns Firebase's provider ids ("password", "google.com", "facebook.com") into the ways the person may confirm. An
 * account offers only the sign-ins it really has, so a Facebook account is never asked for a password it does not have.
 */
export function confirmMethods(providerIds: string[]): ConfirmMethods {
  const social: SocialProvider[] = [];
  if (providerIds.includes('google.com')) social.push('google');
  if (providerIds.includes('facebook.com')) social.push('facebook');
  return { password: providerIds.includes('password'), social };
}

/** True when the account has at least one way to confirm (always, for a real account). */
export function canConfirm(methods: ConfirmMethods): boolean {
  return methods.password || methods.social.length > 0;
}

/** The message for a failed password confirmation, from the Firebase error code. */
export function confirmPasswordErrorKey(error: unknown): MessageKey {
  switch (codeOf(error)) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'pin.reset.wrongPassword';
    case 'auth/too-many-requests':
      return 'auth.error.tooMany';
    case 'auth/network-request-failed':
      return 'verify.error.offline';
    default:
      return 'pin.reset.failed';
  }
}

/**
 * True when Google or Facebook answered for a DIFFERENT account than the one signed in (for example the person picked
 * another Google account on the phone). Firebase refuses that with auth/user-mismatch, and the PIN is not reset.
 */
export function isOtherAccount(error: unknown): boolean {
  return codeOf(error) === 'auth/user-mismatch';
}

function codeOf(value: unknown) {
  return typeof value === 'object' && value !== null && 'code' in value ? String((value as { code: unknown }).code) : '';
}
