// The summary card on the doctor's "Blood Sugar Insights" screen (frame "Blood Sugar Insights", DECISIONS.md D50).
//
// The frame shows an "AI Health Coach" card. D24 keeps the doctor's insights to plain numbers with no AI, so this card
// only compares the newest reading with the patient's own recent readings taken the same way (before or
// after a meal). It never names a cause ("your morning walk") and never gives advice: the doctor does that.
// No thresholds are needed (D4): the class shown is the one saved with each reading. No app imports, so plain Node
// can test it (reading-insight.test.mjs).

type Reading = { readingMgdl: number; context: string; loggedAt: Date | null };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type ReadingComparison =
  /** "This reading is 12% lower than this patient's 7-day average for before-meal readings (161 mg/dL)." */
  | { kind: 'compare'; percent: number; direction: 'higher' | 'lower' | 'same'; average: number; count: number }
  /** No other reading of the same kind in the last 7 days, so there is nothing fair to compare with. */
  | { kind: 'first' };

/**
 * Compares the newest reading with the average of the OTHER readings of the same kind (same meal context) logged in
 * the 7 days before it. Comparing a before-meal reading with an after-meal one would mislead, so other kinds are left out.
 * `readings` may be in any order. null when there are no readings at all.
 */
export function compareLatest<T extends Reading>(readings: T[]): { latest: T; comparison: ReadingComparison } | null {
  const dated = readings.filter((entry): entry is T & { loggedAt: Date } => entry.loggedAt !== null && entry.readingMgdl > 0);
  if (dated.length === 0) return null;
  const sorted = [...dated].sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
  const latest = sorted[0];
  const since = latest.loggedAt.getTime() - WEEK_MS;
  const others = sorted.slice(1).filter((entry) => entry.context === latest.context && entry.loggedAt.getTime() >= since);
  if (others.length === 0) return { latest, comparison: { kind: 'first' } };

  const average = Math.round(others.reduce((sum, entry) => sum + entry.readingMgdl, 0) / others.length);
  const percent = Math.round((Math.abs(latest.readingMgdl - average) / average) * 100);
  const direction = percent === 0 ? 'same' : latest.readingMgdl > average ? 'higher' : 'lower';
  return { latest, comparison: { kind: 'compare', percent, direction, average, count: others.length } };
}
