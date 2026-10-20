import { isFunctionMissing } from '@/lib/feature-unavailable';

// What a person sees when the video room cannot be opened (DECISIONS.md D27). No Firebase import, so `npm test` can
// check it. The server (functions/lib/calls.js) already words its refusals for people ("This call is not active any
// more.", "Video calls are not set up yet..."), so those are shown as they are; anything else becomes a plain message.

export const VIDEO_NOT_SET_UP = 'Video calls are not set up yet. Please use the chat for now.';
export const VIDEO_OFFLINE = "We couldn't reach the video service. Check your internet connection and try again.";
export const VIDEO_PERMISSIONS = 'Allow camera and microphone in Settings to use video calls.';

/** Server refusals whose message was written for people. */
const WORDED_BY_SERVER = ['functions/unavailable', 'functions/failed-precondition', 'functions/permission-denied', 'functions/not-found', 'functions/invalid-argument'];

export function joinErrorMessage(error: unknown): string {
  if (isFunctionMissing(error)) return VIDEO_NOT_SET_UP; // the joinCall endpoint is not deployed yet
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'functions/unauthenticated') return 'Please sign in again to join the call.';
  // The Functions client can append the HTTP status ("... [503]"), and with no server message it uses the bare code.
  const message = error instanceof Error ? error.message.replace(/\s*\[\d{3}\]\s*$/, '').trim() : '';
  if (WORDED_BY_SERVER.includes(code) && message && message !== code.replace('functions/', '')) return message;
  return VIDEO_OFFLINE;
}
