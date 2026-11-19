// The blood sugar trend that can be shared inside the consultation chat (frame "Consultation Chat": the doctor's
// message "Let's look at your trend for the last 3 days" with a small line chart). One point per Philippine calendar
// day (D26): the average of that day's readings, or null when nothing was logged that day.
//
// It only summarises readings the patient already logged. It does not classify them or give advice, so it needs no
// thresholds (D4). Kept free of app imports except manila-time so plain Node can test it (glucose-trend.test.mjs).
import { manilaDayKey, manilaInstant, manilaParts } from '@/features/booking/manila-time';

export type TrendPoint = { day: Date; averageMgdl: number | null };

/** How many days a shared trend covers ("the last 3 days" in the frame). firestore.rules allows at most 7 points. */
export const TREND_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The last `days` Philippine calendar days up to and including today, oldest first. Each day is stored as noon of that
 * day, so it reads as the same date on any phone.
 */
export function dailyTrend(readings: { readingMgdl: number; loggedAt: Date | null }[], now = new Date(), days = TREND_DAYS): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const moment = new Date(now.getTime() - back * DAY_MS);
    const key = manilaDayKey(moment);
    const values = readings
      .filter((reading) => reading.loggedAt && reading.readingMgdl > 0 && manilaDayKey(reading.loggedAt) === key)
      .map((reading) => reading.readingMgdl);
    const { year, month, day } = manilaParts(moment);
    points.push({
      day: manilaInstant(year, month, day, 12),
      averageMgdl: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    });
  }
  return points;
}

/** True when at least one day has a reading, so there is something worth sharing. */
export function hasTrend(points: TrendPoint[]): boolean {
  return points.some((point) => point.averageMgdl !== null);
}
