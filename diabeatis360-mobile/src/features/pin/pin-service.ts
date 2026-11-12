import { requireOptionalNativeModule } from 'expo';
import type * as CryptoModule from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { MAX_PIN_ATTEMPTS } from './pin-rules';

// The app PIN (DECISIONS.md D42). It only unlocks the app ON THIS PHONE; the real login is still Firebase Auth. So the PIN
// is never sent to Firebase: we keep a salted hash of it in the phone's secure storage (the Android Keystore / iOS
// Keychain). The PIN itself is never stored, and a different random "salt" per person means two people with the same PIN
// have different hashes. The secure storage does not exist on the web build, so the PIN is simply off there.

type StoredPin = { salt: string; hash: string };

export type PinCheck =
  | { result: 'ok' }
  | { result: 'wrong'; attemptsLeft: number }
  /** Too many wrong tries: the saved PIN has been deleted and the person must log in with their password. */
  | { result: 'too-many' }
  | { result: 'none' };

// SecureStore keys may only hold letters, digits, "." "-" and "_". A Firebase uid is letters and digits, so it is safe.
const pinKey = (uid: string) => `diabeatis360_pin_${uid}`;
const attemptsKey = (uid: string) => `diabeatis360_pin_tries_${uid}`;

// expo-crypto needs the ExpoCrypto native module. If the app on the phone (for example an older Expo Go) does not contain
// it, a normal top-of-file import would throw while the app is loading and break EVERY screen, because the root layout
// and auth code import this file. So we load it only when the native module exists; without it the PIN is simply off on
// that phone, the same as on the web. (Same approach as reminder-service.ts uses for expo-notifications.)
function loadCrypto(): typeof CryptoModule | null {
  if (!requireOptionalNativeModule('ExpoCrypto')) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-crypto') as typeof CryptoModule;
}

function requireCrypto(): typeof CryptoModule {
  const crypto = loadCrypto();
  if (!crypto) throw new Error('This phone cannot keep a PIN (ExpoCrypto is missing).');
  return crypto;
}

async function hashPin(pin: string, salt: string) {
  const Crypto = requireCrypto();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

function randomSalt() {
  return Array.from(requireCrypto().getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readStored(uid: string): Promise<StoredPin | null> {
  const text = await SecureStore.getItemAsync(pinKey(uid));
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<StoredPin>;
    return typeof value.salt === 'string' && typeof value.hash === 'string' ? { salt: value.salt, hash: value.hash } : null;
  } catch {
    return null;
  }
}

/** Whether this phone can keep a PIN safely (false on the web, or when the app lacks the ExpoCrypto native module). */
export async function pinSupported(): Promise<boolean> {
  if (!loadCrypto()) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Whether this person has a PIN saved on this phone. A storage problem counts as "no PIN" so it never locks anyone out. */
export async function hasPin(uid: string): Promise<boolean> {
  try {
    return (await readStored(uid)) !== null;
  } catch {
    return false;
  }
}

/** Saves a new PIN (replacing any old one) and resets the wrong-try counter. Throws if the phone cannot store it. */
export async function savePin(uid: string, pin: string): Promise<void> {
  const salt = randomSalt();
  const stored: StoredPin = { salt, hash: await hashPin(pin, salt) };
  await SecureStore.setItemAsync(pinKey(uid), JSON.stringify(stored));
  await SecureStore.setItemAsync(attemptsKey(uid), '0');
}

/** Deletes the PIN (at sign-out, or after too many wrong tries). Never throws: it is a clean-up. */
export async function clearPin(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  try {
    await SecureStore.deleteItemAsync(pinKey(uid));
    await SecureStore.deleteItemAsync(attemptsKey(uid));
  } catch {
    // Nothing more can be done; the PIN is checked against this person's uid only.
  }
}

/**
 * Checks a typed PIN. The wrong-try count is kept in secure storage too, so closing and reopening the app does not give
 * five fresh tries. The fifth wrong try deletes the PIN, and the caller then signs the person out.
 */
export async function verifyPin(uid: string, pin: string): Promise<PinCheck> {
  const stored = await readStored(uid);
  if (!stored) return { result: 'none' };
  if ((await hashPin(pin, stored.salt)) === stored.hash) {
    await SecureStore.setItemAsync(attemptsKey(uid), '0');
    return { result: 'ok' };
  }
  const tries = (Number(await SecureStore.getItemAsync(attemptsKey(uid))) || 0) + 1;
  if (tries >= MAX_PIN_ATTEMPTS) {
    await clearPin(uid);
    return { result: 'too-many' };
  }
  await SecureStore.setItemAsync(attemptsKey(uid), String(tries));
  return { result: 'wrong', attemptsLeft: MAX_PIN_ATTEMPTS - tries };
}
