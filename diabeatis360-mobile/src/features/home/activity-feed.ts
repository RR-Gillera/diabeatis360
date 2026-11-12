import type { AppointmentHistoryEntry } from '@/features/booking/types';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { clockTime, shortDay, type Language, type MessageKey } from '@/i18n/translate';

// The "View Activity" screen (opened from Recent Activity on Home) is one timeline of what the patient has done in the
// app. It is built only from data the app already stores, so nothing here is made up:
//   - every Glucose_Logs reading the patient logged, and
//   - every Bookings request the patient made (with its current status).
// Rewards (points, streaks, badges) stay on their own screen, which Profile links to.
export type ActivityItem =
  | { kind: 'reading'; id: string; at: Date | null; entry: GlucoseLogEntry }
  | { kind: 'booking'; id: string; at: Date | null; entry: AppointmentHistoryEntry };

/** Merges readings and bookings into one list, newest first. Items with no date go last. */
export function buildActivityFeed(readings: GlucoseLogEntry[], bookings: AppointmentHistoryEntry[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...readings.map((entry) => ({ kind: 'reading' as const, id: `reading-${entry.id}`, at: entry.loggedAt, entry })),
    ...bookings.map((entry) => ({ kind: 'booking' as const, id: `booking-${entry.id}`, at: entry.scheduledAt, entry })),
  ];
  return items.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
}

/** "Today, 8:30 AM" / "Yesterday, 8:30 AM" / "Oct 29, 8:30 AM". */
export function activityWhen(date: Date | null, language: Language, t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
  if (!date) return '—';
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const time = clockTime(date);
  const DAY = 24 * 60 * 60 * 1000;
  if (target.getTime() === today.getTime()) return t('home.when.today', { time });
  if (target.getTime() === today.getTime() - DAY) return t('home.when.yesterday', { time });
  return `${shortDay(date, language)}, ${time}`;
}
