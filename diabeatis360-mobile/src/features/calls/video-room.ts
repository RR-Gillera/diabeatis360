import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';
import { Camera } from 'expo-camera';

import { functions } from '@/firebase';
import { translate, type Language } from '@/i18n/translate';

import { CallError, joinErrorMessage } from './join-error';

// The video room of an accepted call (DECISIONS.md D27, D39). The room is a LiveKit room: the app asks our server
// (/api/joinCall on Vercel, the same place as the AI functions) and gets back our call page's address with a pass for
// THIS person only. The server checks that the call is accepted and that this person is on it; the LiveKit secret never
// exists in the app, and the pass is never stored. The ringing / accept / hang-up part stays in Firestore (call-service.ts).
const SERVER_URL = (process.env.EXPO_PUBLIC_AI_BASE_URL ?? '').replace(/\/+$/, '');

/** The address to load in the call frame. Throws a CallError whose message can be shown as it is. */
export async function requestCallUrl(bookingId: string, language: Language = 'English'): Promise<string> {
  let url: unknown;
  try {
    const join = SERVER_URL
      ? httpsCallableFromURL<{ bookingId: string }, { url: string }>(functions, `${SERVER_URL}/api/joinCall`)
      : httpsCallable<{ bookingId: string }, { url: string }>(functions, 'joinCall');
    url = (await join({ bookingId })).data?.url;
  } catch (error) {
    throw new CallError(joinErrorMessage(error, language));
  }
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new CallError(joinErrorMessage(null, language));
  // The call page has a few words of its own ("Reconnecting…"), so it is told the language after the "#", beside the pass.
  return language === 'Filipino' && url.includes('#') ? `${url}&lang=fil` : url;
}

/**
 * Asks for the camera and microphone BEFORE a call rings or is answered. On Android the call frame (a WebView) can only
 * use them if the app already has them, so asking later would give a call with no picture or sound.
 */
export async function ensureCallPermissions(language: Language = 'English') {
  const camera = await Camera.requestCameraPermissionsAsync();
  const microphone = camera.granted ? await Camera.requestMicrophonePermissionsAsync() : null;
  if (!camera.granted || !microphone?.granted) throw new CallError(translate(language, 'call.error.permissions'));
}
