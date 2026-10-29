import { translate, type Language, type MessageKey } from '@/i18n/translate';
import { isFunctionMissing } from '@/lib/feature-unavailable';

// What a person sees when the video room cannot be opened (DECISIONS.md D27). No Firebase import, so `npm test` can
// check it. The server (functions/lib/calls.js) already words its refusals for people ("This call is not active any
// more.", "Video calls are not set up yet..."), so in English those are shown as they are, and in Filipino the same
// refusal is said in Filipino (D33). Anything else becomes a plain message.

export const VIDEO_NOT_SET_UP = translate('English', 'call.error.notSetUp');
export const VIDEO_OFFLINE = translate('English', 'call.error.offline');

/** An error whose message was written for people, already in their language, so a screen can show it as it is. */
export class CallError extends Error {}

/** Server refusals whose message was written for people. */
const WORDED_BY_SERVER = ['functions/unavailable', 'functions/failed-precondition', 'functions/permission-denied', 'functions/not-found', 'functions/invalid-argument'];

/** Every refusal the server words (functions/lib/calls.js), so it can be said in Filipino. A test keeps the two in step. */
export const SERVER_WORDING: Record<string, MessageKey> = {
  'That call is not valid.': 'call.error.invalid',
  'This call no longer exists.': 'call.error.gone',
  'You are not part of this call.': 'call.error.notYours',
  'Video calls are only for a confirmed appointment.': 'call.error.notConfirmed',
  'This call is not active any more.': 'call.error.notActive',
  'Video calls are not set up yet. Please use the chat for now.': 'call.error.notSetUp',
  'The video service is busy right now. Please try again in a moment.': 'call.error.busy',
};

export function joinErrorMessage(error: unknown, language: Language = 'English'): string {
  if (isFunctionMissing(error)) return translate(language, 'call.error.notSetUp'); // the joinCall endpoint is not deployed yet
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'functions/unauthenticated') return translate(language, 'call.error.signIn');
  // The Functions client can append the HTTP status ("... [503]"), and with no server message it uses the bare code.
  const message = error instanceof Error ? error.message.replace(/\s*\[\d{3}\]\s*$/, '').trim() : '';
  if (WORDED_BY_SERVER.includes(code) && message && message !== code.replace('functions/', '')) {
    if (language === 'English') return message;
    const key = SERVER_WORDING[message];
    return key ? translate(language, key) : translate(language, 'call.error.room');
  }
  return translate(language, 'call.error.offline');
}
