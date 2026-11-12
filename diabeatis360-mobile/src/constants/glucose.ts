// Blood sugar classification (mg/dL). The ONE place the cut-offs live: no screen or service may hardcode them.
// Source: DECISIONS.md D4 (closed 2026-09-26), based on common American Diabetes Association (ADA) targets
// for adults with diabetes. Confirm with the adviser / a doctor respondent and cite the ADA in the manuscript.
//
// | Class          | Before meal / fasting | After meal |
// | Critical low   | below 54              | below 54   |
// | Low            | 54 - 69               | 54 - 69    |
// | Normal         | 70 - 130              | 70 - 179   |
// | High           | 131 - 249             | 180 - 249  |
// | Critical high  | 250 and above         | 250+       |
//
// Prediabetes (DECISIONS.md D40, team choice "option A"): normal is the range for people WITHOUT diabetes, because the
// goal is to get back to it: 70 - 99 before a meal, 70 - 139 after. Above that is high. Low and critical are the same
// for every type. Type 1, Type 2 and a type not stated use the table above. To be confirmed by the adviser or a doctor.
//
// Kept free of app imports (type-only imports are erased) so it can be unit-tested with plain Node:
//   npm test
import type { Interpretation, MealContext } from './enums';

export const GLUCOSE_THRESHOLDS = {
  /** Below this is critical (dangerously low), in both contexts. */
  criticalLow: 54,
  /** Below this (and not critical) is low. */
  low: 70,
  /** Highest value still "normal", per meal context. */
  normalMax: { before_meal: 130, after_meal: 179 },
  /** Highest value still "normal" for a person with prediabetes (D40): the range for people without diabetes. */
  prediabetesNormalMax: { before_meal: 99, after_meal: 139 },
  /** At or above this is critical (dangerously high), in both contexts. */
  criticalHigh: 250,
} as const;

/** The highest "normal" reading for this context and diabetes type ('Prediabetes'; anything else uses the D4 targets). */
export function normalMaxFor(context: MealContext, diabetesType?: string): number {
  return (diabetesType === 'Prediabetes' ? GLUCOSE_THRESHOLDS.prediabetesNormalMax : GLUCOSE_THRESHOLDS.normalMax)[context];
}

/**
 * Classifies a reading for a person's diabetes type (D40; leave it out for the D4 targets). `critical` covers both
 * directions; use glucoseDirection() to tell them apart.
 */
export function interpretGlucose(readingMgdl: number, context: MealContext, diabetesType?: string): Interpretation {
  if (readingMgdl < GLUCOSE_THRESHOLDS.criticalLow || readingMgdl >= GLUCOSE_THRESHOLDS.criticalHigh) return 'critical';
  if (readingMgdl < GLUCOSE_THRESHOLDS.low) return 'low';
  if (readingMgdl > normalMaxFor(context, diabetesType)) return 'high';
  return 'normal';
}

/** Which way a non-normal reading is off: used to word critical guidance ("dangerously low" vs "very high"). */
export function glucoseDirection(readingMgdl: number, context: MealContext, diabetesType?: string): 'low' | 'normal' | 'high' {
  if (readingMgdl < GLUCOSE_THRESHOLDS.low) return 'low';
  if (readingMgdl > normalMaxFor(context, diabetesType)) return 'high';
  return 'normal';
}

// Which numbers a person may log at all (DECISIONS.md D25). Home meters measure roughly 20-600 mg/dL and show
// "LO"/"HI" outside that, so a value outside it is a typing mistake, not a reading: it is refused here, in the
// service, and in firestore.rules (Glucose_Logs). Values near the ends are possible but rare, so the person is asked
// to check their meter before saving. These limits do not change the D4 classes above.
export const READING_LIMITS = {
  /** Lowest value that can be saved. */
  min: 20,
  /** Highest value that can be saved. */
  max: 600,
  /** Below this (and from min up), ask "Is this right?" before saving. */
  confirmBelow: 40,
  /** Above this (and up to max), ask "Is this right?" before saving. */
  confirmAbove: 400,
} as const;

export type ReadingCheck =
  // `reason` lets the screen say it in the person's language (D33); `message` is the English text.
  | { ok: false; reason: 'notNumber' | 'decimal' | 'range'; message: string }
  | { ok: true; needsConfirmation: boolean };

/** Checks a typed reading before it is saved. Whole numbers only: meters show mg/dL without decimals. */
export function checkReading(value: number): ReadingCheck {
  if (!Number.isFinite(value)) return { ok: false, reason: 'notNumber', message: 'Enter your reading as a number.' };
  if (!Number.isInteger(value)) return { ok: false, reason: 'decimal', message: 'Enter a whole number (meters show mg/dL without decimals).' };
  if (value < READING_LIMITS.min || value > READING_LIMITS.max) {
    return { ok: false, reason: 'range', message: `Enter a reading from ${READING_LIMITS.min} to ${READING_LIMITS.max} mg/dL. Check the number on your meter.` };
  }
  return { ok: true, needsConfirmation: value < READING_LIMITS.confirmBelow || value > READING_LIMITS.confirmAbove };
}
