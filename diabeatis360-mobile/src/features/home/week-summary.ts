// What Home says about the last 7 days (DECISIONS.md D34). Home used to show a fixed "Your glucose levels have been
// stable this week" to everyone, even after a critical reading; now every word comes from the person's own readings.
// No app imports, so npm test checks it.

type Reading = { readingMgdl: number; interpretation: 'low' | 'normal' | 'high' | 'critical'; loggedAt: Date | null };

export type WeekSummary = {
  /** Readings logged in the last 7 days (today and the 6 days before). */
  count: number;
  /** Of those, how many were in the normal range (constants/glucose.ts, D4). */
  inRange: number;
  /** Whether any of them was critical. */
  anyCritical: boolean;
  /** Whole-number average of those readings, or null when there are none. */
  average: number | null;
  /** Which message Home shows (the text is in en.ts / fil.ts). */
  insight: 'none' | 'critical' | 'good' | 'mixed';
};

const DAY = 24 * 60 * 60 * 1000;

export function weekSummary(entries: Reading[], now = new Date()): WeekSummary {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime() - 6 * DAY;
  const week = entries.filter((entry) => entry.loggedAt && entry.loggedAt.getTime() >= from && entry.loggedAt.getTime() <= now.getTime());
  const count = week.length;
  const inRange = week.filter((entry) => entry.interpretation === 'normal').length;
  const anyCritical = week.some((entry) => entry.interpretation === 'critical');
  const average = count ? Math.round(week.reduce((sum, entry) => sum + entry.readingMgdl, 0) / count) : null;
  // A critical reading always wins: no "keep it up" after a dangerous week.
  const insight = !count ? 'none' : anyCritical ? 'critical' : inRange / count >= 0.7 ? 'good' : 'mixed';
  return { count, inRange, anyCritical, average, insight };
}
