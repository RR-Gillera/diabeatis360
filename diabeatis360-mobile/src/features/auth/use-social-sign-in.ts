import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from './auth-context';
import { isCancelled, socialErrorMessage, type SocialProvider } from './social-types';

/**
 * The Google and Facebook buttons, shared by the Login and Sign Up screens (DECISIONS.md D23). `start(provider)` runs the
 * sign-in and then goes where a normal login would: "Check your email" for an unconfirmed address, the home screen for
 * someone who has finished onboarding, onboarding for everyone else. `busy` is the provider being worked on, so the
 * screen can show a spinner and ignore a second tap. A problem is reported through `showError`.
 */
export function useSocialSignIn(showError: (message: string) => void) {
  const router = useRouter();
  const { signInWithProvider, hasCompletedOnboarding } = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const start = async (provider: SocialProvider) => {
    if (busy) return;
    setBusy(provider);
    showError('');
    try {
      const result = await signInWithProvider(provider);
      if (result.needsEmailVerification) {
        // ?sent=1 / ?sent=0 tells that screen whether the email just went out; no param means "they may already have one".
        const params = result.verificationEmailSent === null ? {} : { sent: result.verificationEmailSent ? '1' : '0' };
        router.replace({ pathname: '/verify-email', params } as never);
      } else if (await hasCompletedOnboarding(result.email)) {
        router.replace(result.role === 'doctor' ? '/doctor' : '/user-home');
      } else {
        router.replace('/onboarding/language');
      }
    } catch (value) {
      // Closing Google's or Facebook's window is the person's choice, not an error.
      if (!isCancelled(value)) showError(socialErrorMessage(value, provider));
    } finally {
      setBusy(null);
    }
  };

  return { busy, start };
}
