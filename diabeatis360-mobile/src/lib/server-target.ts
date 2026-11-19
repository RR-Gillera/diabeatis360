// The ONE place that decides where server calls go (AI suggestions, label scan, product lookup, video join, family SMS).
// Why: QA found that EXPO_PUBLIC_AI_BASE_URL (the live Vercel server) overrode emulator mode, so a test phone could
// send real AI requests, join real video rooms and trigger real family SMS (defect PAT-002).
//
// Precedence rule:
//   1. Emulator mode (dev build AND EXPO_PUBLIC_USE_EMULATORS=true): always the Functions emulator (src/firebase.js
//      connects it on 127.0.0.1:5001). EXPO_PUBLIC_AI_BASE_URL is IGNORED, so production can never be reached.
//   2. Otherwise, EXPO_PUBLIC_AI_BASE_URL if set (the live Vercel server, DECISIONS.md D19).
//   3. Otherwise, plain Cloud Functions.
//
// Process env values must be read as `process.env.EXPO_PUBLIC_X` literally for Expo to inline them, so the callers
// below pass them in; this file stays pure and `npm test` can check the rule.

export const TEST_MODE_UNAVAILABLE_MESSAGE =
  'Not available in test mode. The local test server does not have this feature running.';

export function isEmulatorMode(isDev: boolean, useEmulators: string | undefined): boolean {
  return isDev && useEmulators === 'true';
}

/** '' means "no custom address: use the Firebase SDK's own functions (emulator or Cloud Functions)". */
export function resolveServerBaseUrl(emulatorMode: boolean, configuredUrl: string | undefined): string {
  if (emulatorMode) return '';
  return (configuredUrl ?? '').replace(/\/+$/, '');
}

/** The base URL for the running app. Empty string means use `httpsCallable` (which the emulator setup redirects locally). */
export function serverBaseUrl(): string {
  return resolveServerBaseUrl(
    isEmulatorMode(__DEV__, process.env.EXPO_PUBLIC_USE_EMULATORS),
    process.env.EXPO_PUBLIC_AI_BASE_URL,
  );
}

export function inEmulatorMode(): boolean {
  return isEmulatorMode(__DEV__, process.env.EXPO_PUBLIC_USE_EMULATORS);
}
