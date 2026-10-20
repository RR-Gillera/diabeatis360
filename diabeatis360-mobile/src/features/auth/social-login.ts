// Asks Google or Facebook who the person is (DECISIONS.md D23). This is the only file that touches the two native
// libraries, and it only runs on the Android app that is built with them:
//   Google    react-native-nitro-google-signin (Android's Credential Manager account picker) -> an ID token
//   Facebook  react-native-fbsdk-next (Facebook's login screen)                               -> an access token
// social-service.ts then hands the token to Firebase. On the web, social-login.web.ts takes this file's place.
//
// The libraries are loaded only when a button is tapped, not when the app starts. Expo Go does not contain them, and
// loading them up front would stop the whole app from opening there. A phone that lacks them just gets the message
// "works in the installed app".
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

import { SocialLoginError, type SocialProvider, type SocialToken } from './social-types';

type GoogleModule = typeof import('react-native-nitro-google-signin');
type FacebookModule = typeof import('react-native-fbsdk-next');

// Expo Go is the one place where these libraries are expected to be missing. In the installed app a missing library is a
// problem with the build, and "works in the installed app" would only confuse the tester there.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function missingLibrary(name: string) {
  if (inExpoGo) return new SocialLoginError('unavailable');
  console.warn(`${name} is not part of this build`); // for the team (adb logcat); nothing personal
  return new SocialLoginError('failed');
}

/** Runs a dynamic import and turns "this library is not in the app" into our own error. */
async function loadNativeModule<T>(load: () => Promise<T>, name: string) {
  try {
    return await load();
  } catch {
    throw missingLibrary(name);
  }
}

export async function getSocialToken(provider: SocialProvider): Promise<SocialToken> {
  // Only the Android app is set up and tested (the team ships an APK). Nothing is configured for iOS.
  if (Platform.OS !== 'android') throw new SocialLoginError('unavailable');
  return provider === 'google' ? googleToken() : facebookToken();
}

async function googleToken(): Promise<SocialToken> {
  const google = await loadNativeModule(() => import('react-native-nitro-google-signin'), 'Google sign-in');
  // The "Web client ID" from Firebase > Authentication > Sign-in method > Google. A public ID, not a secret.
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new SocialLoginError('not-configured');

  try {
    google.GoogleOneTapSignIn.configure({ webClientId });
    await google.GoogleOneTapSignIn.checkPlayServices(); // offers Google's own "update Play services" dialog if needed
    // The standard "Sign in with Google" account picker. Always lists every Google account on the phone.
    const response = await google.GoogleOneTapSignIn.presentExplicitSignIn();
    if (response.type === 'cancelled') throw new SocialLoginError('cancelled');
    if (!google.isSuccessResponse(response)) throw new SocialLoginError('failed');
    return { provider: 'google', token: response.data.idToken };
  } catch (error) {
    throw googleFailure(error, google);
  }
}

function googleFailure(error: unknown, google: GoogleModule) {
  if (error instanceof SocialLoginError) return error;
  if (google.isErrorWithCode(error)) {
    // For the team when testing on a phone (adb logcat): the library's status code, nothing personal.
    console.warn('Google sign-in stopped:', error.code);
    if (error.code === google.statusCodes.SIGN_IN_CANCELLED) return new SocialLoginError('cancelled');
    if (error.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new SocialLoginError('play-services');
    // Wrong SHA-1 or package name in the Firebase/Google Cloud setup (docs/GO_LIVE.md A10).
    if (error.code === google.statusCodes.DEVELOPER_ERROR) return new SocialLoginError('not-configured');
  }
  return new SocialLoginError('failed');
}

// The app is built with Facebook's SDK switched off at start-up (app.config.js), so nothing reaches Facebook until
// someone taps the button. This starts it, once, at that moment.
let facebookStarted = false;
function startFacebook(facebook: FacebookModule) {
  if (facebookStarted) return;
  facebook.Settings.initializeSDK();
  facebookStarted = true;
}

async function facebookToken(): Promise<SocialToken> {
  // Expo Go has no Facebook code, so the native module is missing: say "installed app" rather than "not set up".
  if (!NativeModules.FBLoginManager) throw missingLibrary('Facebook sign-in');
  const facebook = await loadNativeModule(() => import('react-native-fbsdk-next'), 'Facebook sign-in');
  // Set by the team once the Meta app exists (docs/GO_LIVE.md A10); app.config.js adds the Facebook settings from it.
  if (!process.env.EXPO_PUBLIC_FACEBOOK_APP_ID) throw new SocialLoginError('not-configured');

  try {
    startFacebook(facebook);
    // Forget any earlier Facebook login on this phone, so the person always chooses for themselves.
    facebook.LoginManager.logOut();
    const login = await facebook.LoginManager.logInWithPermissions(['public_profile', 'email']);
    if (login.isCancelled) throw new SocialLoginError('cancelled');
    // Someone who said no to sharing their email is refused later by social-service.ts, with the clear message.
    const access = await facebook.AccessToken.getCurrentAccessToken();
    if (!access?.accessToken) throw new SocialLoginError('failed');
    return { provider: 'facebook', token: access.accessToken };
  } catch (error) {
    throw error instanceof SocialLoginError ? error : new SocialLoginError('failed');
  }
}

/**
 * Forgets the Google/Facebook login that this phone kept, called when someone logs out of the app. `providerIds` are
 * the Firebase provider ids of the account being signed out ("google.com", "facebook.com"): an email-and-password
 * account touches neither library. Best effort: a failure here must never stop the log-out.
 */
export async function clearSocialSessions(providerIds: string[]) {
  if (Platform.OS !== 'android') return;
  if (providerIds.includes('google.com')) {
    try {
      const google = await import('react-native-nitro-google-signin');
      await google.GoogleOneTapSignIn.signOut();
    } catch {
      // not in this build, or nothing to clear
    }
  }
  // The ID check matters: starting Facebook's SDK in a build that has no Facebook ID would crash the app instead of failing.
  if (providerIds.includes('facebook.com') && process.env.EXPO_PUBLIC_FACEBOOK_APP_ID && NativeModules.FBLoginManager) {
    try {
      const facebook = await import('react-native-fbsdk-next');
      startFacebook(facebook);
      facebook.LoginManager.logOut();
    } catch {
      // not in this build, or nothing to clear
    }
  }
}
