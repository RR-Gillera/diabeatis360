// Weekly challenges and milestones (DECISIONS.md D51; manuscript Objective 3d, Gantt 5.5 "Milestones, Challenges").
//
// Challenges are counted automatically from the patient's own blood sugar readings: nobody "joins" one and nothing new is
// stored. A week is Monday 00:00 to Sunday 23:59 Philippine time (UTC+8), like bookings (D26), so the week ends at the
// same moment on every phone. Each challenge finished in a week adds its bonus points once for that week, and the bonus
// is part of the patient's wellness points, so it also moves them toward the Silver and Gold milestones (member-tier.ts).
//
// Points stay DERIVED from the readings (gamification-service.ts explains why): recomputing always gives the same total,
// and the challenges of past weeks keep counting. Kept free of Firebase and React so plain Node tests it.
import { manilaParts } from '@/features/booking/manila-time';

export type ChallengeId = 'log_days' | 'meal_pairs' | 'readings';

/** The three challenges of every week: how much is needed and the bonus points for finishing it. */
export const WEEKLY_CHALLENGES: readonly { id: ChallengeId; goal: number; points: number }[] = [
  { id: 'log_days', goal: 5, points: 30 }, // log a reading on 5 different days
  { id: 'meal_pairs', goal: 3, points: 30 }, // on 3 days, log both a before-meal and an after-meal reading
  { id: 'readings', goal: 14, points: 20 }, // log 14 readings in the week
];

type Reading = { loggedAt: Date | null; context: string };

export type ChallengeProgress = { id: ChallengeId; goal: number; points: number; value: number; done: boolean };

const pad = (value: number) => String(value).padStart(2, '0');

/** The Philippine calendar day of a moment, as "2026-11-20". */
export function manilaDayKey(instant: Date): string {
  const { year, month, day } = manilaParts(instant);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** The Monday (Philippine date) that starts the week a moment falls in, as "2026-11-16". */
export function manilaWeekKey(instant: Date): string {
  const { year, month, day } = manilaParts(instant);
  const date = new Date(Date.UTC(year, month, day));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7; // Sunday is 0 in JavaScript; here it is the last day
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** How far one week's readings go toward each challenge. */
function progressOf(readings: Reading[]): Record<ChallengeId, number> {
  const days = new Map<string, Set<string>>();
  for (const reading of readings) {
    if (!reading.loggedAt) continue;
    const key = manilaDayKey(reading.loggedAt);
    if (!days.has(key)) days.set(key, new Set());
    days.get(key)!.add(reading.context);
  }
  const pairs = [...days.values()].filter((contexts) => contexts.has('before_meal') && contexts.has('after_meal')).length;
  return { log_days: days.size, meal_pairs: pairs, readings: readings.filter((reading) => reading.loggedAt).length };
}

function byWeek(readings: Reading[]) {
  const weeks = new Map<string, Reading[]>();
  for (const reading of readings) {
    if (!reading.loggedAt) continue;
    const key = manilaWeekKey(reading.loggedAt);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(reading);
  }
  return weeks;
}

/** This week's challenges with the patient's progress (value never shown above the goal). */
export function weeklyChallenges(readings: Reading[], now: Date = new Date()): ChallengeProgress[] {
  const thisWeek = byWeek(readings).get(manilaWeekKey(now)) ?? [];
  const progress = progressOf(thisWeek);
  return WEEKLY_CHALLENGES.map((challenge) => ({
    ...challenge,
    value: Math.min(progress[challenge.id], challenge.goal),
    done: progress[challenge.id] >= challenge.goal,
  }));
}

/** Bonus points from every challenge finished, this week and in all past weeks (each counted once per week). */
export function challengeBonus(readings: Reading[]): number {
  let total = 0;
  for (const weekReadings of byWeek(readings).values()) {
    const progress = progressOf(weekReadings);
    for (const challenge of WEEKLY_CHALLENGES) if (progress[challenge.id] >= challenge.goal) total += challenge.points;
  }
  return total;
}

/** How far the points are between the current tier's start and the next tier (0 to 1); 1 at the top tier. */
export function milestoneProgress(points: number, tierStart: number, nextStart: number | null): number {
  if (nextStart === null) return 1;
  const span = nextStart - tierStart;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (points - tierStart) / span));
}
