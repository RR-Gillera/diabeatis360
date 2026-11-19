// The consultation fee a doctor may set (QA ADM-005, DECISIONS.md D46). One rule for every screen that sets a fee: the
// doctor's Set Consultation Fee and Profile screens here, and the admin panel's Add Provider
// (diabeatis360-admin/src/lib/fee.js says the same). firestore.rules (Providers) refuses a fee below 0 or above
// MAX_CONSULTATION_FEE whatever a screen does, so change all three together.
//
// 0 means "not set yet": the rules allow it (a doctor who signs up has no fee), but such a doctor is not listed on Find
// a Doctor (features/doctor/profile-complete.ts), so a screen that sets a fee asks for more than ₱0.
// No imports, so plain Node tests it (fees.test.mjs).

/** A sanity ceiling, so a typo such as an extra zero is caught before patients see it. */
export const MAX_CONSULTATION_FEE = 20000;

export type FeeProblem = 'notNumber' | 'tooLow' | 'tooHigh';

/** Reads a typed fee. Commas, spaces and a peso sign are ignored ("₱1,500" is 1500); a minus sign is kept, so -100 is
 *  refused instead of quietly becoming 100. Anything else that is not a number gives NaN. */
export function parseFee(text: string): number {
  const cleaned = text.replace(/[₱,\s]/g, '');
  return cleaned ? Number(cleaned) : NaN;
}

/** Why a fee cannot be saved, or null when it can: more than ₱0 and at most MAX_CONSULTATION_FEE. */
export function feeProblem(fee: number): FeeProblem | null {
  if (!Number.isFinite(fee)) return 'notNumber';
  if (fee <= 0) return 'tooLow';
  if (fee > MAX_CONSULTATION_FEE) return 'tooHigh';
  return null;
}

/** A fee rounded to the centavo, the way it is stored. */
export function roundFee(fee: number): number {
  return Math.round(fee * 100) / 100;
}
