// Numbers on the doctor's screens (Figma: Dashboard, D-06 Insights, D-11 Requests; DECISIONS D24). No app imports
// except manila-time (itself import-free), so plain Node can test them (doctor-stats.test.mjs). Callers pass in what
// they need, such as the commission rate.

import { manilaDayKey } from '@/features/booking/manila-time';

type Booking = { status: string; scheduledAt: Date | null; fee: number; paymentStatus: string };
type Reading = { readingMgdl: number; interpretation?: string | null; loggedAt: Date | null };

export type RequestTab = 'pending' | 'accepted' | 'declined';

export const REQUEST_TABS: { key: RequestTab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

/** Where a booking shows on the Requests screen. Completed consultations are under History instead (null here). */
export function requestTabFor(status: string): RequestTab | null {
  if (status === 'pending') return 'pending';
  if (status === 'confirmed') return 'accepted';
  if (status === 'declined' || status === 'cancelled') return 'declined';
  return null;
}

/** The "Filters" sheet on the Requests screen (frame "Appointment Requests"): which days to show and in what order. */
export type RequestSort = 'soonest' | 'latest';
export type RequestRange = 'all' | 'today' | 'week';

/**
 * Requests in the chosen range and order. "Today" and "next 7 days" are Philippine calendar days (D26), counted from
 * today; "next 7 days" also keeps anything earlier today or overdue, so a pending request is never hidden by the filter.
 * A booking without a time sorts last and only shows under "All dates".
 */
export function filterRequests<T extends { scheduledAt: Date | null }>(entries: T[], sort: RequestSort, range: RequestRange, now = new Date()): T[] {
  const todayKey = manilaDayKey(now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inRange = (entry: T) => {
    if (range === 'all') return true;
    if (!entry.scheduledAt) return false;
    if (range === 'today') return manilaDayKey(entry.scheduledAt) === todayKey;
    return entry.scheduledAt.getTime() <= weekEnd.getTime();
  };
  const time = (entry: T) => entry.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return entries
    .filter(inRange)
    .sort((a, b) => (sort === 'soonest' ? time(a) - time(b) : (b.scheduledAt?.getTime() ?? -1) - (a.scheduledAt?.getTime() ?? -1)));
}

// Appointments belong to the clinic's day in the Philippines (DECISIONS D26), whatever time zone the phone is set to.
const sameDay = (a: Date, b: Date) => manilaDayKey(a) === manilaDayKey(b);

/**
 * The four dashboard cards. Earnings are what the doctor keeps from finished consultations that were paid (online or
 * on-site): the fee minus the platform commission (D3). Payments are a demo, so these are recorded amounts.
 */
export function dashboardStats(bookings: Booking[], commissionRate: number, now: Date = new Date()) {
  const today = bookings.filter((entry) => entry.scheduledAt && sameDay(entry.scheduledAt, now) && (entry.status === 'confirmed' || entry.status === 'completed')).length;
  const pending = bookings.filter((entry) => entry.status === 'pending').length;
  const finished = bookings.filter((entry) => entry.status === 'completed');
  const earnings = finished.filter(countsAsEarned).reduce((total, entry) => total + netFee(entry.fee, commissionRate), 0);
  return { today, pending, completed: finished.length, earnings: Math.round(earnings * 100) / 100 };
}

// Paid online only (DECISIONS D37): an on-site fee is paid to the doctor at the clinic, so the app never saw it.
const countsAsEarned = (entry: Booking) => entry.status === 'completed' && entry.paymentStatus === 'paid';
/** What the doctor keeps from one fee: the fee minus the platform commission (D3), rounded to centavos. */
const netFee = (fee: number, commissionRate: number) => fee - Math.round(fee * commissionRate * 100) / 100;

/**
 * The line under "Total Earnings" (dashboard frame): what the doctor earned on each of the last `days` Philippine days,
 * oldest first, ending today. Same rule as dashboardStats, so the line and the total never disagree.
 */
export function dailyEarnings(bookings: Booking[], commissionRate: number, now: Date = new Date(), days = 7): number[] {
  const dayKeys = Array.from({ length: days }, (_, index) => manilaDayKey(new Date(now.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000)));
  const totals = new Map(dayKeys.map((key) => [key, 0]));
  for (const entry of bookings) {
    if (!entry.scheduledAt || !countsAsEarned(entry)) continue;
    const key = manilaDayKey(entry.scheduledAt);
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + netFee(entry.fee, commissionRate));
  }
  return dayKeys.map((key) => Math.round((totals.get(key) ?? 0) * 100) / 100);
}

/**
 * The pill next to "Next Consultation" ("In 15 mins"): how long until the appointment starts. 'now' once it has
 * started (the dashboard keeps showing it for an hour after its start).
 */
export function startsIn(at: Date, now: Date = new Date()): { unit: 'now' | 'minutes' | 'hours' | 'days'; value: number } {
  const minutes = Math.ceil((at.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return { unit: 'now', value: 0 };
  if (minutes < 60) return { unit: 'minutes', value: minutes };
  if (minutes < 24 * 60) return { unit: 'hours', value: Math.floor(minutes / 60) };
  return { unit: 'days', value: Math.floor(minutes / (24 * 60)) };
}

/** Whole years between a birthdate and today, or null when unknown. */
export function ageFrom(birthdate: Date | null, now: Date = new Date()) {
  if (!birthdate) return null;
  let age = now.getFullYear() - birthdate.getFullYear();
  const birthdayPassed = now.getMonth() > birthdate.getMonth() || (now.getMonth() === birthdate.getMonth() && now.getDate() >= birthdate.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * The "Insights" tab (D-06, DECISIONS D24: plain numbers, no AI): the last 7 days' average, the share of readings in the
 * normal range, and the highest and lowest reading. null when there are no readings in that week.
 */
export function weeklyInsights(readings: Reading[], now: Date = new Date()) {
  const since = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const week = readings.filter((entry) => entry.loggedAt && entry.loggedAt.getTime() >= since && entry.loggedAt.getTime() <= now.getTime());
  if (week.length === 0) return null;
  const values = week.map((entry) => entry.readingMgdl);
  const inRange = week.filter((entry) => entry.interpretation === 'normal').length;
  return {
    count: week.length,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    inRangePercent: Math.round((inRange / week.length) * 100),
    highest: Math.max(...values),
    lowest: Math.min(...values),
  };
}
