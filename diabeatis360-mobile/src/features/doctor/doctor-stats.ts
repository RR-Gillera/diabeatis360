// Numbers on the doctor's screens (Figma: Dashboard, D-06 Insights, D-11 Requests; DECISIONS D24). No imports on purpose,
// so plain Node can test them (doctor-stats.test.mjs). Callers pass in what they need, such as the commission rate.

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

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The four dashboard cards. Earnings are what the doctor keeps from finished consultations that were paid (online or
 * on-site): the fee minus the platform commission (D3). Payments are a demo, so these are recorded amounts.
 */
export function dashboardStats(bookings: Booking[], commissionRate: number, now: Date = new Date()) {
  const today = bookings.filter((entry) => entry.scheduledAt && sameDay(entry.scheduledAt, now) && (entry.status === 'confirmed' || entry.status === 'completed')).length;
  const pending = bookings.filter((entry) => entry.status === 'pending').length;
  const finished = bookings.filter((entry) => entry.status === 'completed');
  const earnings = finished
    // Paid online only (DECISIONS D37): an on-site fee is paid to the doctor at the clinic, so the app never saw it.
    .filter((entry) => entry.paymentStatus === 'paid')
    .reduce((total, entry) => total + entry.fee - Math.round(entry.fee * commissionRate * 100) / 100, 0);
  return { today, pending, completed: finished.length, earnings: Math.round(earnings * 100) / 100 };
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
