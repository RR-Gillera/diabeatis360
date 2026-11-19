// "Available now" next to the date on the doctor's dashboard (frame "Dashboard", 2026-11-19). The frame says "Online",
// but the app does not track whether a doctor has the app open (that would be a new Providers field). What it does know
// is the doctor's schedule, so the dashboard says whether patients can request a consultation at this moment.
//
// Kept apart from availability.ts so that file stays about the schedule itself. No React or Firebase here, so plain
// Node tests it (available-now.test.mjs).
import { manilaParts } from '@/features/booking/manila-time';

import { bookableSchedule, type Availability } from './availability';
import { minutesFromLabel } from './time-slots';

/**
 * Whether patients can request this doctor right now: always with Available 24/7, otherwise only on a working day
 * inside one of that day's slots. Read in Philippine time like every booking (DECISIONS D26), from the same
 * bookableSchedule the patient's time picker uses. A slot's end time is not included.
 */
export function isAvailableAt(availability: Availability | null, now: Date = new Date()): boolean {
  if (availability?.availabilityMode === 'always') return true;
  const schedule = bookableSchedule(availability);
  const { year, month, day, hour, minute } = manilaParts(now);
  // The Philippine weekday, Monday = 0 … Sunday = 6 (getUTCDay() counts from Sunday = 0).
  const weekday = (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
  if (!schedule.days.includes(weekday)) return false;
  const minutes = hour * 60 + minute;
  return (schedule.hours[weekday] ?? []).some((range) => {
    const start = minutesFromLabel(range.start);
    const end = minutesFromLabel(range.end);
    return start !== null && end !== null && minutes >= start && minutes < end;
  });
}
