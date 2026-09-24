// Doctors pick free-form availability windows ("7:00 PM – 9:00 PM") rather than
// ticking fixed slots, so every bookable time in the app is derived from those
// windows. One place owns the label format, the parsing, and the slot spacing.

export type TimeRange = { start: string; end: string };

/** Minutes between bookable slots inside a doctor's availability window. */
export const SLOT_INTERVAL_MINUTES = 30;

/** "07:30 PM" -> 1170 (minutes since midnight). Returns null if unparseable. */
export function minutesFromLabel(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(label.trim());
  if (!match) return null;
  const [, hourText, minuteText, meridiem] = match;
  let hour = Number(hourText) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(minuteText);
}

/** 1170 -> "07:30 PM", zero-padded to match every other time label in the app. */
export function labelFromMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

/** Every selectable time of day, used to populate the range pickers. */
export const TIME_OPTIONS = Array.from(
  { length: (24 * 60) / SLOT_INTERVAL_MINUTES },
  (_, index) => labelFromMinutes(index * SLOT_INTERVAL_MINUTES),
);

/**
 * Expands availability windows into the individual slots a patient can book.
 * The end of a window is exclusive — a 7:00–9:00 PM window offers 7:00, 7:30,
 * 8:00 and 8:30, because a slot starting at 9:00 would run past the window.
 */
export function slotsFromRanges(ranges: TimeRange[]): string[] {
  const slots = new Set<number>();
  for (const range of ranges) {
    const start = minutesFromLabel(range.start);
    const end = minutesFromLabel(range.end);
    if (start === null || end === null || end <= start) continue;
    for (let minute = start; minute + SLOT_INTERVAL_MINUTES <= end; minute += SLOT_INTERVAL_MINUTES) {
      slots.add(minute);
    }
  }
  return [...slots].sort((a, b) => a - b).map(labelFromMinutes);
}

export function isMorning(label: string) {
  const minutes = minutesFromLabel(label);
  return minutes !== null && minutes < 12 * 60;
}

export function formatRange(range: TimeRange) {
  return `${range.start} – ${range.end}`;
}
