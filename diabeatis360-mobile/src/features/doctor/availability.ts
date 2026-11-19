// A doctor's availability (the Manage Schedule module, DECISIONS.md D43 and D48). A doctor is either open every day at
// any time ('always'), or open on their own weekly days, each day with its own time slots ('custom').
//
// This one file decides which days and times patients are offered. The doctor's "Current configuration" card, the
// dashboard card and the patient's time picker all read it from here, so what the doctor is told can never differ from
// what patients see.
//
// No React or Firebase here, so plain Node tests it (availability.test.mjs).
import type { AvailabilityMode } from '@/constants/enums';

import { DEFAULT_BOOKING_WINDOW, labelFromMinutes, minutesFromLabel, SLOT_INTERVAL_MINUTES, slotsFromRanges, type TimeRange } from './time-slots';

/** The doctor's slots for each weekday: index 0 = Monday … 6 = Sunday, like Providers.available_days. */
export type WeeklyHours = TimeRange[][];

/** The availability fields of a Providers document, as the app holds them. */
export type Availability = {
  availabilityMode: AvailabilityMode;
  /** Weekday indexes the doctor works, Monday = 0 … Sunday = 6. Used only with 'custom'. */
  availableDays: number[];
  /**
   * The doctor's time slots per weekday (D48), e.g. Monday 9:00 AM – 1:00 PM and 2:00 PM – 6:00 PM. Used only with
   * 'custom'. A switched-off day keeps its slots, so switching it back on brings them back.
   */
  weeklyHours: WeeklyHours;
};

/** Monday first: the order Providers.available_days is stored in (0 = Monday). Also the keys of the weekday texts. */
export const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The keys of the Providers.weekly_hours map, Monday first: { mon: [...], tue: [...], … }. */
export const WEEK_STORE_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Every weekday index, Monday (0) to Sunday (6). */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** A week with no slots on any day. */
export function emptyWeek(): WeeklyHours {
  return ALL_DAYS.map(() => []);
}

/** Every bookable time of a whole day: "12:00 AM", "12:30 AM" … "11:30 PM" (48 slots when a slot is 30 minutes). */
export function allDaySlots(): string[] {
  const slots: string[] = [];
  for (let minute = 0; minute < 24 * 60; minute += SLOT_INTERVAL_MINUTES) slots.push(labelFromMinutes(minute));
  return slots;
}

/** Keeps only well-formed { start, end } pairs of text, so a damaged document cannot break a screen. */
function cleanRanges(value: unknown): TimeRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((range) => range && typeof range === 'object' && range.start && range.end)
    .map((range) => ({ start: String(range.start), end: String(range.end) }));
}

/**
 * Reads the week from a Providers document.
 * - `weekly_hours` (a map, D48): each day's own slots.
 * - No `weekly_hours` (every doctor saved before D48): the old shared `available_ranges` apply to every day, which is
 *   exactly what those doctors were offering, so nothing has to be migrated.
 */
export function weekFromStored(weeklyHours: unknown, legacyRanges: unknown): WeeklyHours {
  if (weeklyHours && typeof weeklyHours === 'object' && !Array.isArray(weeklyHours)) {
    const map = weeklyHours as Record<string, unknown>;
    return WEEK_STORE_KEYS.map((key) => cleanRanges(map[key]));
  }
  const shared = cleanRanges(legacyRanges);
  return ALL_DAYS.map(() => shared.map((range) => ({ ...range })));
}

/** The week as it is written to Providers.weekly_hours: { mon: [{ start, end }], tue: [], … }. */
export function weekForStore(week: WeeklyHours): Record<string, TimeRange[]> {
  return Object.fromEntries(WEEK_STORE_KEYS.map((key, day) => [key, cleanRanges(week[day])]));
}

/**
 * The doctor's time windows that can hold at least one slot. A window shorter than one slot, or one that ends before
 * it starts, offers patients nothing, so it does not count as "hours set".
 */
export function usableRanges(ranges: TimeRange[]): TimeRange[] {
  return ranges.filter((range) => slotsFromRanges([range]).length > 0);
}

/** Why a custom week cannot be saved, and on which day. `null` means it can be saved. */
export type WeekProblem =
  | { code: 'noDays' }
  | { code: 'noSlots' | 'tooShort' | 'overlap'; day: number };

/**
 * Checks a custom week before it is saved:
 * - at least one day is switched on;
 * - every switched-on day has at least one slot;
 * - every slot is long enough for one booking (SLOT_INTERVAL_MINUTES) and ends after it starts;
 * - two slots on the same day do not overlap (9:00 AM – 1:00 PM and 12:00 PM – 3:00 PM would).
 * Saving anything else would silently give patients the default hours or a confusing schedule, so it is refused.
 */
export function weekProblem(availableDays: number[], week: WeeklyHours): WeekProblem | null {
  const days = [...new Set(availableDays)].sort((a, b) => a - b);
  if (days.length === 0) return { code: 'noDays' };
  for (const day of days) {
    const ranges = week[day] ?? [];
    if (ranges.length === 0) return { code: 'noSlots', day };
    if (usableRanges(ranges).length !== ranges.length) return { code: 'tooShort', day };
    const sorted = ranges
      .map((range) => ({ start: minutesFromLabel(range.start) ?? 0, end: minutesFromLabel(range.end) ?? 0 }))
      .sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) return { code: 'overlap', day };
    }
  }
  return null;
}

/** True when the doctor's own week is complete and could be saved as it is (see weekProblem). */
export function hasOwnHours(availability: Availability): boolean {
  return weekProblem(availability.availableDays, availability.weeklyHours) === null;
}

/**
 * The days and times patients can request for a doctor. `hours` and `slots` have one entry per weekday (0 = Monday).
 * - 'always': every day, every half hour of the day. `hours` is empty for each day, meaning the whole day.
 * - 'custom': the doctor's own days, each with its own slots. Whatever the doctor has not chosen falls back to the
 *   default (every day; DEFAULT_BOOKING_WINDOW on a day with no usable slot), so a doctor who never opened the
 *   schedule screen can still be booked.
 * `null` means the doctor's profile has not loaded yet; it gets the default too.
 */
export function bookableSchedule(availability: Availability | null): { days: number[]; hours: TimeRange[][]; slots: string[][] } {
  if (availability?.availabilityMode === 'always') {
    return { days: ALL_DAYS, hours: ALL_DAYS.map(() => []), slots: ALL_DAYS.map(() => allDaySlots()) };
  }
  const ownDays = availability?.availableDays ?? [];
  const hours = ALL_DAYS.map((day) => {
    const own = usableRanges(availability?.weeklyHours[day] ?? []);
    return own.length ? own : [DEFAULT_BOOKING_WINDOW];
  });
  return { days: ownDays.length ? [...ownDays].sort((a, b) => a - b) : ALL_DAYS, hours, slots: hours.map(slotsFromRanges) };
}

/** The weekday index of a date, Monday = 0 … Sunday = 6 (JavaScript's getDay() starts on Sunday). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The hours shared by every one of `days`, or null when they differ. The cards use it to say "Mon – Fri · 9:00 AM –
 * 5:00 PM" when one line is true for all of them, and "hours vary by day" otherwise.
 */
export function sharedHours(hours: TimeRange[][], days: number[]): TimeRange[] | null {
  if (days.length === 0) return null;
  const key = (ranges: TimeRange[]) => ranges.map((range) => `${range.start}-${range.end}`).join(',');
  const first = key(hours[days[0]] ?? []);
  return days.every((day) => key(hours[day] ?? []) === first) ? hours[days[0]] ?? [] : null;
}

/**
 * A short way to say a set of weekdays: "Every day", one unbroken run of three or more ("Mon – Fri"), or a list
 * ("Mon, Wed, Fri"). The screen passes the day names in its own language, Monday first.
 */
export function daysText(days: number[], dayNames: readonly string[], everyDay: string): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === ALL_DAYS.length) return everyDay;
  const unbroken = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (sorted.length >= 3 && unbroken) return `${dayNames[sorted[0]]} – ${dayNames[sorted[sorted.length - 1]]}`;
  return sorted.map((day) => dayNames[day]).join(', ');
}

/** "9:00 AM – 12:00 PM, 7:00 PM – 9:00 PM": the time windows on one line, without the leading zero. */
export function hoursText(ranges: TimeRange[]): string {
  return ranges.map((range) => `${range.start.replace(/^0/, '')} – ${range.end.replace(/^0/, '')}`).join(', ');
}

/** The four parts of the day the patient's time picker groups its slots under, in the order they are shown. */
export const DAY_PERIODS = ['early', 'morning', 'afternoon', 'evening'] as const;
export type DayPeriod = (typeof DAY_PERIODS)[number];

/** The part of the day a slot starts in: before 6 AM, before noon, before 6 PM, or later. */
export function periodOf(label: string): DayPeriod {
  const minutes = minutesFromLabel(label) ?? 0;
  if (minutes < 6 * 60) return 'early';
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 18 * 60) return 'afternoon';
  return 'evening';
}
