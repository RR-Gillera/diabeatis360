// A doctor's availability (the Manage Schedule module, DECISIONS.md D43). A doctor is either open every day at any
// time ('always'), or open on their own weekly days and hours ('custom').
//
// This one file decides which days and times patients are offered. The doctor's "Current configuration" card, the
// dashboard card and the patient's time picker all read it from here, so what the doctor is told can never differ from
// what patients see.
//
// No React or Firebase here, so plain Node tests it (availability.test.mjs).
import type { AvailabilityMode } from '@/constants/enums';

import { DEFAULT_BOOKING_WINDOW, labelFromMinutes, minutesFromLabel, SLOT_INTERVAL_MINUTES, slotsFromRanges, type TimeRange } from './time-slots';

/** The three availability fields of a Providers document, as the app holds them. */
export type Availability = {
  availabilityMode: AvailabilityMode;
  /** Weekday indexes the doctor works, Monday = 0 … Sunday = 6. Used only with 'custom'. */
  availableDays: number[];
  /** The doctor's time windows, e.g. 9:00 AM to 12:00 PM. Used only with 'custom'. */
  availableRanges: TimeRange[];
};

/** Monday first: the order Providers.available_days is stored in (0 = Monday). Also the keys of the weekday texts. */
export const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Every weekday index, Monday (0) to Sunday (6). */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Every bookable time of a whole day: "12:00 AM", "12:30 AM" … "11:30 PM" (48 slots when a slot is 30 minutes). */
export function allDaySlots(): string[] {
  const slots: string[] = [];
  for (let minute = 0; minute < 24 * 60; minute += SLOT_INTERVAL_MINUTES) slots.push(labelFromMinutes(minute));
  return slots;
}

/**
 * The doctor's time windows that can hold at least one slot. A window shorter than one slot, or one that ends before
 * it starts, offers patients nothing, so it does not count as "hours set".
 */
export function usableRanges(ranges: TimeRange[]): TimeRange[] {
  return ranges.filter((range) => slotsFromRanges([range]).length > 0);
}

/** True when the doctor's own schedule is complete: at least one working day and one usable time window. */
export function hasOwnHours(availability: Availability): boolean {
  return availability.availableDays.length > 0 && usableRanges(availability.availableRanges).length > 0;
}

/**
 * The days and times patients can request for a doctor.
 * - 'always': every day, every half hour of the day.
 * - 'custom': the doctor's own days and hours. Whatever the doctor has not chosen falls back to the default (every
 *   day, DEFAULT_BOOKING_WINDOW), so a doctor who never opened the schedule screen can still be booked.
 * `hours` are the windows the slots come from. It is empty for 'always', which is the whole day.
 * `null` means the doctor's profile has not loaded yet; it gets the default too.
 */
export function bookableSchedule(availability: Availability | null): { days: number[]; hours: TimeRange[]; slots: string[] } {
  if (availability?.availabilityMode === 'always') return { days: ALL_DAYS, hours: [], slots: allDaySlots() };
  const ownDays = availability?.availableDays ?? [];
  const ownHours = usableRanges(availability?.availableRanges ?? []);
  const hours = ownHours.length ? ownHours : [DEFAULT_BOOKING_WINDOW];
  return { days: ownDays.length ? ownDays : ALL_DAYS, hours, slots: slotsFromRanges(hours) };
}

/**
 * Whether two availabilities are the same setting. The schedule screen uses it to tell a saved setting ("LIVE") from
 * one the doctor changed but has not saved yet. With 'always' the days and hours are not used, so they are not compared.
 */
export function sameAvailability(a: Availability, b: Availability): boolean {
  if (a.availabilityMode !== b.availabilityMode) return false;
  if (a.availabilityMode === 'always') return true;
  const daysOf = (days: number[]) => [...days].sort((x, y) => x - y).join(',');
  const hoursOf = (ranges: TimeRange[]) => ranges.map((range) => `${range.start}-${range.end}`).join(',');
  return daysOf(a.availableDays) === daysOf(b.availableDays) && hoursOf(a.availableRanges) === hoursOf(b.availableRanges);
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
