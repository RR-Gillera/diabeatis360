import { glucoseDirection, interpretGlucose } from '@/constants/glucose';
import { manilaParts, manilaSlotLabel } from '@/features/booking/manila-time';

import type { MealContext } from './types';

// What a patient's doctor reads when the patient logs a CRITICAL reading (DECISIONS.md D28). Only Firebase-free imports,
// so `npm test` can check it. The thresholds come from constants/glucose.ts (D4); nothing is decided here.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The doctor's notification text, or null when the reading is not critical (then no doctor is told). */
export function doctorCriticalAlert(patientName: string, readingMgdl: number, context: MealContext, loggedAt: Date): string | null {
  if (interpretGlucose(readingMgdl, context) !== 'critical') return null;
  const level = glucoseDirection(readingMgdl, context) === 'low' ? 'very low' : 'very high';
  const meal = context === 'after_meal' ? 'after a meal' : 'before a meal';
  const { month, day } = manilaParts(loggedAt);
  // "03:40 PM" -> "3:40 PM"; Philippine time, like the booking times (D26).
  const time = manilaSlotLabel(loggedAt).replace(/^0/, '');
  const name = patientName.trim() || 'Your patient';
  return `Critical reading: ${name} logged ${readingMgdl} mg/dL (${level}, ${meal}) at ${time}, ${MONTHS[month]} ${day}. `
    + 'The patient was told to contact a doctor or seek emergency care.';
}
