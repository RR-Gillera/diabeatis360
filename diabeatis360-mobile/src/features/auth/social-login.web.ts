// The web build of social-login.ts. Google and Facebook sign-in use native Android libraries, so a browser (and the
// Expo web dev server the team uses for quick checks) cannot do them. The screens show "works in the installed app".
// Keeping this file separate also keeps the native libraries out of the web bundle altogether.
import { SocialLoginError, type SocialProvider, type SocialToken } from './social-types';

export const getSocialToken: (provider: SocialProvider) => Promise<SocialToken> = async () => {
  throw new SocialLoginError('unavailable');
};

// Nothing is kept on the web, so there is nothing to clear.
export const clearSocialSessions: (providerIds: string[]) => Promise<void> = async () => {};
