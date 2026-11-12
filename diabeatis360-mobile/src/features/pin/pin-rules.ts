// The rules of the app PIN (DECISIONS.md D42). No imports, so plain Node tests it (pin-rules.test.mjs).

/** A PIN is exactly this many digits, like GCash. */
export const PIN_LENGTH = 6;

/** After this many wrong tries in a row the person is signed out and must log in with their password again. */
export const MAX_PIN_ATTEMPTS = 5;

/** The app asks for the PIN again when it was in the background for longer than this. */
export const LOCK_AFTER_MS = 30_000;

/** True only for exactly PIN_LENGTH digits (no letters, no spaces). */
export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** 000000, 111111 ... or a straight run such as 123456 / 654321: too easy for someone to guess. */
export function isEasyPin(pin: string): boolean {
  if (!isValidPin(pin)) return false;
  const digits = [...pin].map(Number);
  const step = digits[1] - digits[0];
  if (step !== 0 && Math.abs(step) !== 1) return false;
  return digits.every((digit, index) => index === 0 || digit - digits[index - 1] === step);
}

/** Whether coming back to the app after `awayMs` milliseconds in the background must ask for the PIN. */
export function shouldLockAfter(awayMs: number): boolean {
  return awayMs > LOCK_AFTER_MS;
}
