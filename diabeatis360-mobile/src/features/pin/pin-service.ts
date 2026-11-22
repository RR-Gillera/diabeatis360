import { requireOptionalNativeModule } from 'expo';
import type * as CryptoModule from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '@/firebase';

import { MAX_PIN_ATTEMPTS } from './pin-rules';

// The app PIN (DECISIONS.md D42, made account-wide by D53). The PIN belongs to the ACCOUNT, like GCash's MPIN: it is the
// same on every phone and survives a reinstall. The real login is still Firebase Auth; the PIN only unlocks the app.
//
// Where it is kept:
//  - Firestore `App_Pins/{uid}` is the source of truth: a random salt, a salted SHA-256 hash and the wrong-try count.
//    The PIN itself is never stored or sent. Only the owner can read or write that document (firestore.rules), not
//    doctors and not admins, because a 6-digit PIN has only a million possibilities and a leaked hash could be guessed.
//  - The phone's secure storage (Android Keystore / iOS Keychain) keeps a copy, so unlocking is instant and works offline.
// The secure storage does not exist on the web build, so the PIN is simply off there.

const PINS = 'App_Pins';

/** `synced` = this copy is known to be in Firestore. A copy without it was made before D53 and is uploaded once. */
type StoredPin = { salt: string; hash: string; synced?: boolean };

export type PinCheck =
  | { result: 'ok' }
  | { result: 'wrong'; attemptsLeft: number }
  /** Too many wrong tries: the saved PIN has been deleted and the person must log in with their password. */
  | { result: 'too-many' }
  | { result: 'none' };

/** 'yes' / 'no' = the account has / has no PIN. 'unknown' = this phone has no copy and Firestore could not be reached. */
export type PinStatus = 'yes' | 'no' | 'unknown';

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

// ---- the copy on this phone

async function readLocal(uid: string): Promise<StoredPin | null> {
  const text = await SecureStore.getItemAsync(pinKey(uid));
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<StoredPin>;
    return typeof value.salt === 'string' && typeof value.hash === 'string'
      ? { salt: value.salt, hash: value.hash, synced: value.synced === true }
      : null;
  } catch {
    return null;
  }
}

async function writeLocal(uid: string, stored: StoredPin, attempts: number) {
  await SecureStore.setItemAsync(pinKey(uid), JSON.stringify(stored));
  await SecureStore.setItemAsync(attemptsKey(uid), String(attempts));
}

async function clearLocal(uid: string) {
  await SecureStore.deleteItemAsync(pinKey(uid));
  await SecureStore.deleteItemAsync(attemptsKey(uid));
}

// ---- the account's PIN in Firestore

type AccountPin = { salt: string; hash: string; failedAttempts: number };

/** Gives up after a few seconds, so a phone with no signal is not stuck on a blank screen waiting for Firestore. */
function withTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore timed out')), ms))]);
}

/** The account's PIN, or null when it has none. Throws when Firestore cannot be reached. */
async function readAccount(uid: string): Promise<AccountPin | null> {
  const snapshot = await withTimeout(getDoc(doc(db, PINS, uid)));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (typeof data.salt !== 'string' || typeof data.hash !== 'string') return null;
  return { salt: data.salt, hash: data.hash, failedAttempts: typeof data.failed_attempts === 'number' ? data.failed_attempts : 0 };
}

async function writeAccount(uid: string, stored: StoredPin, failedAttempts: number) {
  await withTimeout(setDoc(doc(db, PINS, uid), { salt: stored.salt, hash: stored.hash, failed_attempts: failedAttempts, updated_at: serverTimestamp() }));
}

/** Saves the wrong-try count to the account too, so a reinstall does not give fresh tries. A failure is not fatal. */
async function saveAttempts(uid: string, attempts: number) {
  await SecureStore.setItemAsync(attemptsKey(uid), String(attempts));
  await withTimeout(updateDoc(doc(db, PINS, uid), { failed_attempts: attempts, updated_at: serverTimestamp() })).catch(() => {});
}

// ---- used by the screens

/** Whether this phone can keep a PIN safely (false on the web, or when the app lacks the ExpoCrypto native module). */
export async function pinSupported(): Promise<boolean> {
  if (!loadCrypto()) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Whether this ACCOUNT has a PIN, and brings this phone's copy up to date with Firestore (the account always wins):
 *  - Firestore has a PIN: it is copied to this phone (a reinstall, a new phone, or a PIN changed on another phone);
 *  - Firestore has none, but this phone has an old copy made before D53: that copy is uploaded once;
 *  - Firestore has none and this phone's copy was already uploaded: the PIN was reset ("Forgot PIN?") elsewhere, so the
 *    copy is deleted.
 * With no signal it trusts this phone's copy; with no copy either it says 'unknown', so the app never asks someone to
 * make a NEW PIN (which would replace their real one) just because it could not check.
 */
export async function pinStatus(uid: string): Promise<PinStatus> {
  let local: StoredPin | null = null;
  try {
    local = await readLocal(uid);
  } catch {
    // An unreadable copy counts as no copy; Firestore decides below.
  }

  let account: AccountPin | null;
  try {
    account = await readAccount(uid);
  } catch {
    return local ? 'yes' : 'unknown';
  }

  try {
    if (account) {
      const localTries = Number(await SecureStore.getItemAsync(attemptsKey(uid))) || 0;
      await writeLocal(uid, { salt: account.salt, hash: account.hash, synced: true }, Math.max(localTries, account.failedAttempts));
      return 'yes';
    }
    if (local && !local.synced) {
      const tries = Number(await SecureStore.getItemAsync(attemptsKey(uid))) || 0;
      await writeAccount(uid, local, tries);
      await writeLocal(uid, { ...local, synced: true }, tries);
      return 'yes';
    }
    if (local) await clearLocal(uid);
    return 'no';
  } catch {
    return local || account ? 'yes' : 'unknown';
  }
}

/** Quick check of this phone's copy only (no network), used when the app comes back from the background. */
export async function hasPin(uid: string): Promise<boolean> {
  try {
    return (await readLocal(uid)) !== null;
  } catch {
    return false;
  }
}

/**
 * Saves a new PIN (replacing any old one) to the account and to this phone, and resets the wrong-try counter. Throws
 * if either save fails (for example with no signal), so the person is told and the old PIN stays in place.
 */
export async function savePin(uid: string, pin: string): Promise<void> {
  const salt = randomSalt();
  const stored: StoredPin = { salt, hash: await hashPin(pin, salt), synced: true };
  await writeAccount(uid, stored, 0);
  await writeLocal(uid, stored, 0);
}

/** Deletes the PIN from the account and this phone ("Forgot PIN?" or too many wrong tries). Never throws: it is a clean-up. */
export async function clearPin(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  await withTimeout(deleteDoc(doc(db, PINS, uid))).catch(() => {});
  await clearLocal(uid).catch(() => {});
}

/**
 * Checks a typed PIN against the account's PIN (this phone's copy of it, fetched first if missing). The wrong-try count is
 * kept on the phone and in the account, so neither closing the app nor reinstalling it gives five fresh tries. The fifth
 * wrong try deletes the PIN, and the caller then signs the person out.
 */
export async function verifyPin(uid: string, pin: string): Promise<PinCheck> {
  let stored = await readLocal(uid);
  if (!stored && (await pinStatus(uid)) === 'yes') stored = await readLocal(uid);
  if (!stored) return { result: 'none' };
  const previousTries = Number(await SecureStore.getItemAsync(attemptsKey(uid))) || 0;
  if ((await hashPin(pin, stored.salt)) === stored.hash) {
    if (previousTries > 0) await saveAttempts(uid, 0); // only written when there is something to reset
    return { result: 'ok' };
  }
  const tries = previousTries + 1;
  if (tries >= MAX_PIN_ATTEMPTS) {
    await clearPin(uid);
    return { result: 'too-many' };
  }
  await saveAttempts(uid, tries);
  return { result: 'wrong', attemptsLeft: MAX_PIN_ATTEMPTS - tries };
}
