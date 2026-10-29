// Small helpers for the "Check your email" step (DECISIONS.md D21). No Firebase or React imports, so plain Node can
// test them (verification.test.mjs); the Firebase calls themselves live in auth-context.tsx.
import { translate, type Language } from '@/i18n/translate';

/** Seconds the "Resend email" button waits after an email went out, so a second tap cannot send a second one. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** How often the screen quietly asks Firebase whether the emailed link has been tapped. */
export const CHECK_INTERVAL_MS = 4000;

/** Seconds the "Resend link" button on the password-reset screen waits (Figma P-02 shows 00:30). */
export const RESET_RESEND_SECONDS = 30;

/**
 * "maria.santos@email.com" -> "m***@email.com": shows which address the email went to without spelling it out on a
 * screen someone else may be looking at (Figma P-02, P-03). Anything that is not an address comes back unchanged.
 */
export function maskEmail(email: string | null | undefined) {
  const value = (email ?? '').trim();
  const at = value.indexOf('@');
  if (at < 1) return value;
  return `${value[0]}***${value.slice(at)}`;
}

/** 45 -> "0:45", 61 -> "1:01". Never negative. */
export function formatCountdown(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Which language to ask Firebase to write the verification email in. A phone set to Filipino ("fil", or "tl" for
 * Tagalog) asks for "fil"; everything else gets English. If Firebase has no Filipino template for the project it falls
 * back to its default (English) email, so asking is always safe.
 */
export function emailLanguageFor(locale: string | undefined | null) {
  const language = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return language === 'fil' || language === 'tl' ? 'fil' : 'en';
}

/**
 * The phone's language setting, e.g. "fil_PH" or "en-PH": the first place that says something, in the order they are
 * given. Falls back to English. The caller lists the phone's own setting first (auth-context.tsx), because the
 * JavaScript `Intl` default can disagree with it (Edge reports "en-PH" for a browser set to Filipino).
 */
export function firstLocale(...candidates: (string | undefined | null)[]) {
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? 'en';
}

/** A plain-language reason for a failed send or check, from the Firebase error code. */
export function verificationErrorMessage(code: string | undefined, language: Language = 'English') {
  switch (code) {
    case 'auth/too-many-requests':
      return translate(language, 'verify.error.tooMany');
    case 'auth/network-request-failed':
      return translate(language, 'verify.error.offline');
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
    case 'auth/user-not-found':
      return translate(language, 'verify.error.expired');
    default:
      return translate(language, 'verify.error.generic');
  }
}

/** The `code` of a thrown Firebase error, or undefined. */
export function errorCode(value: unknown) {
  return typeof value === 'object' && value && 'code' in value ? String((value as { code: unknown }).code) : undefined;
}
