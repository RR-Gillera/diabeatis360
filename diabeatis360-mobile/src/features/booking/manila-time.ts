// Booking times are Philippine time (UTC+8, no daylight saving), whatever time zone the phone is set to
// (DECISIONS.md D26). The doctor's slots ("09:30 AM") are clinic hours in the Philippines, so a slot is turned into an
// exact moment here, and "already passed" is decided against that moment. firestore.rules then checks the same
// moment against the server's clock, which a patient cannot change.
//
// Done with plain arithmetic instead of the phone's time-zone database (Intl), so it behaves the same on every phone.
// Kept free of app imports so it can be unit-tested with plain Node (npm test).
const OFFSET_MS = 8 * 60 * 60 * 1000;

export type ManilaParts = { year: number; month: number; day: number; hour: number; minute: number };

/** The Philippine calendar date and clock time of a moment. month is 0-11 like Date. */
export function manilaParts(instant: Date): ManilaParts {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

/** The moment that is the given Philippine date and time. */
export function manilaInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

/** Today in the Philippines, as a calendar day (local midnight with that year, month and day) for the date picker. */
export function manilaToday(now = new Date()): Date {
  const { year, month, day } = manilaParts(now);
  return new Date(year, month, day);
}

/** "09:30 AM" -> { hour: 9, minute: 30 }; anything else -> null. */
export function parseSlotLabel(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(time.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return { hour, minute: Number(match[2]) };
}

/** A calendar day from the picker plus a slot label, as the exact moment in the Philippines. */
export function slotInstant(day: Date, time: string): Date | null {
  const parsed = parseSlotLabel(time);
  return parsed ? manilaInstant(day.getFullYear(), day.getMonth(), day.getDate(), parsed.hour, parsed.minute) : null;
}

/** True when the slot has already started (or the label cannot be read). */
export function isPastSlot(day: Date, time: string, now = new Date()): boolean {
  const instant = slotInstant(day, time);
  return !instant || instant.getTime() <= now.getTime();
}

/** The "09:30 AM" label of a moment, in Philippine time (zero-padded like the picker's labels). */
export function manilaSlotLabel(instant: Date): string {
  const { hour, minute } = manilaParts(instant);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(twelve).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Whether a moment falls on the given calendar day, in the Philippines. */
export function isSameManilaDay(instant: Date, day: Date): boolean {
  const parts = manilaParts(instant);
  return parts.year === day.getFullYear() && parts.month === day.getMonth() && parts.day === day.getDate();
}
