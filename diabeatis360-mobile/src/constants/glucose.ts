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
  /** At or above this is critical (dangerously high), in both contexts. */
  criticalHigh: 250,
} as const;

/** Classifies a reading. `critical` covers both directions; use glucoseDirection() to tell them apart. */
export function interpretGlucose(readingMgdl: number, context: MealContext): Interpretation {
  if (readingMgdl < GLUCOSE_THRESHOLDS.criticalLow || readingMgdl >= GLUCOSE_THRESHOLDS.criticalHigh) return 'critical';
  if (readingMgdl < GLUCOSE_THRESHOLDS.low) return 'low';
  if (readingMgdl > GLUCOSE_THRESHOLDS.normalMax[context]) return 'high';
  return 'normal';
}

/** Which way a non-normal reading is off: used to word critical guidance ("dangerously low" vs "very high"). */
export function glucoseDirection(readingMgdl: number, context: MealContext): 'low' | 'normal' | 'high' {
  if (readingMgdl < GLUCOSE_THRESHOLDS.low) return 'low';
  if (readingMgdl > GLUCOSE_THRESHOLDS.normalMax[context]) return 'high';
  return 'normal';
}
