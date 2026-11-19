// The weekly blood sugar chart's numbers, for the patient's Log tab and the doctor's patient record (QA DOC-010,
// DECISIONS.md D46). Moved here from glucose-service.ts so plain Node can test it (week-chart.test.mjs): no app imports
// except types, which are erased.
//
// QA found the chart plotted only one average per day, so a 262 mg/dL critical reading among normal ones showed as a
// 174 point, under a scale that stopped at 200: a doctor scanning the chart saw no spike. Now each day also keeps its
// lowest and highest reading (a bar behind the line) and its critical readings (red dots at their real values), and the
// scale always reaches the week's real lowest and highest reading.
import type { Interpretation } from '@/constants/enums';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Reading = { readingMgdl: number; interpretation: Interpretation; loggedAt: Date | null };

export type ChartDay = {
  label: string;
  /** The day's average, rounded (the line). null on a day with no reading: the chart leaves it out rather than invent one. */
  value: number | null;
  /** The day's lowest and highest reading (the bar behind the line). */
  low: number | null;
  high: number | null;
  /** The day's critical readings in mg/dL, drawn as red dots at their real values. */
  critical: number[];
};

export type CriticalReading = { readingMgdl: number; loggedAt: Date };

const roundedAverage = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

/**
 * This calendar week (Monday to Sunday, the phone's days, as before): each day's average, lowest, highest and critical
 * readings, and for the whole week the average, the lowest and highest reading, and its critical readings, newest first.
 * The class saved with each reading decides "critical" (D40); critical is the same for every diabetes type (D4).
 */
export function bucketCurrentWeek(entries: Reading[], now: Date = new Date()) {
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekEnd = new Date(monday); weekEnd.setDate(monday.getDate() + 7);
  const between = (start: Date, end: Date) => entries.filter((entry) => entry.loggedAt !== null && entry.loggedAt >= start && entry.loggedAt < end);

  const days: ChartDay[] = WEEKDAY_LABELS.map((label, index) => {
    const dayStart = new Date(monday); dayStart.setDate(monday.getDate() + index);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
    const dayEntries = between(dayStart, dayEnd);
    const values = dayEntries.map((entry) => entry.readingMgdl);
    return {
      label,
      value: roundedAverage(values),
      low: values.length ? Math.min(...values) : null,
      high: values.length ? Math.max(...values) : null,
      critical: dayEntries.filter((entry) => entry.interpretation === 'critical').map((entry) => entry.readingMgdl),
    };
  });

  const week = between(monday, weekEnd);
  const values = week.map((entry) => entry.readingMgdl);
  const criticalReadings: CriticalReading[] = week
    .filter((entry): entry is Reading & { loggedAt: Date } => entry.interpretation === 'critical' && entry.loggedAt !== null)
    .map((entry) => ({ readingMgdl: entry.readingMgdl, loggedAt: entry.loggedAt }))
    .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
  return {
    days,
    average: roundedAverage(values),
    lowest: values.length ? Math.min(...values) : null,
    highest: values.length ? Math.max(...values) : null,
    criticalReadings,
  };
}

/**
 * The chart's scale: from the lowest reading of the week to the highest (not just the daily averages), on round 20s and
 * at least 60 apart, plus the critical thresholds (constants/glucose.ts, D4) that fall inside it, drawn as dashed red
 * lines. null when fewer than two days have a reading (the chart shows its empty text instead).
 */
export function chartScale(days: ChartDay[], criticalLow: number, criticalHigh: number) {
  const present = days.filter((day) => day.value !== null);
  if (present.length < 2) return null;
  const lows = present.map((day) => day.low ?? (day.value as number));
  const highs = present.map((day) => day.high ?? (day.value as number));
  const min = Math.floor(Math.min(...lows) / 20) * 20;
  const max = Math.max(min + 60, Math.ceil(Math.max(...highs) / 20) * 20);
  return { min, max, thresholds: [criticalHigh, criticalLow].filter((value) => value >= min && value <= max) };
}
