import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';
import type { GlucoseLogEntry } from '@/features/glucose/types';

export type Badge = {
  id: string;
  name: string;
  description: string;
  criteria: string;
  /** How many qualifying events are needed, parsed from the criteria text. */
  threshold: number;
  kind: BadgeKind;
};

export type EarnedBadge = { badgeId: string; earnedAt: Date | null };

export type WellnessStats = {
  /** Consecutive days up to today with at least one reading logged. */
  streak: number;
  /** Longest run of consecutive logging days on record. */
  bestStreak: number;
  totalLogs: number;
  daysLogged: number;
  points: number;
};

type BadgeKind = 'logs' | 'streak' | 'other';

// The seeded Badges collection stores criteria as free text ("1 glucose log
// entry", "7 day streak"). Rather than add a schema migration, the number and
// the kind are read out of that text — anything unrecognised becomes a badge
// that simply can't be auto-awarded yet, which is honest about the data we have.
function parseCriteria(criteria: string): { threshold: number; kind: BadgeKind } {
  const text = criteria.toLowerCase();
  const amount = Number(/(\d+)/.exec(text)?.[1] ?? 0);
  if (text.includes('streak') || text.includes('day')) return { threshold: amount || 1, kind: 'streak' };
  if (text.includes('log') || text.includes('entry') || text.includes('reading')) return { threshold: amount || 1, kind: 'logs' };
  return { threshold: amount || 0, kind: 'other' };
}

/** Points are earned per reading logged, with a bonus for keeping a streak. */
const POINTS_PER_LOG = 5;
const POINTS_PER_STREAK_DAY = 2;

export function wellnessStats(entries: GlucoseLogEntry[]): WellnessStats {
  const dayKeys = new Set<string>();
  for (const entry of entries) {
    if (entry.loggedAt) dayKeys.add(entry.loggedAt.toDateString());
  }
  const days = [...dayKeys].map((key) => { const date = new Date(key); date.setHours(0, 0, 0, 0); return date.getTime(); }).sort((a, b) => b - a);

  const DAY = 24 * 60 * 60 * 1000;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // The current streak only counts if the most recent logged day is today or
  // yesterday — otherwise the run has already been broken.
  let streak = 0;
  if (days.length && (days[0] === today.getTime() || days[0] === today.getTime() - DAY)) {
    streak = 1;
    for (let index = 1; index < days.length; index += 1) {
      if (days[index - 1] - days[index] === DAY) streak += 1;
      else break;
    }
  }

  let bestStreak = days.length ? 1 : 0;
  let run = days.length ? 1 : 0;
  for (let index = 1; index < days.length; index += 1) {
    if (days[index - 1] - days[index] === DAY) run += 1;
    else run = 1;
    bestStreak = Math.max(bestStreak, run);
  }

  return {
    streak,
    bestStreak,
    totalLogs: entries.length,
    daysLogged: days.length,
    points: entries.length * POINTS_PER_LOG + streak * POINTS_PER_STREAK_DAY,
  };
}

export function subscribeToBadges(onChange: (badges: Badge[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'Badges'),
    (snapshot) => onChange(snapshot.docs.map((document) => {
      const data = document.data();
      const criteria = String(data.criteria ?? '');
      return {
        id: document.id,
        name: String(data.badge_name ?? 'Badge'),
        description: String(data.badge_description ?? ''),
        criteria,
        ...parseCriteria(criteria),
      };
    })),
    (error) => onError(error),
  );
}

export function subscribeToEarnedBadges(userId: string, onChange: (earned: EarnedBadge[]) => void, onError: (error: Error) => void) {
  const earnedQuery = query(collection(db, 'User_Badges'), where('user_id', '==', userId));
  return onSnapshot(
    earnedQuery,
    (snapshot) => onChange(snapshot.docs.map((document) => ({
      badgeId: String(document.data().badge_id ?? ''),
      earnedAt: (document.data().earned_at as Timestamp | undefined)?.toDate?.() ?? null,
    }))),
    (error) => onError(error),
  );
}

export function hasQualified(badge: Badge, stats: WellnessStats) {
  if (badge.kind === 'logs') return stats.totalLogs >= badge.threshold;
  if (badge.kind === 'streak') return stats.bestStreak >= badge.threshold;
  return false;
}

/**
 * Persists the derived streak/points onto the Gamification doc and awards any
 * newly qualified badges.
 *
 * The numbers are *derived* from Glucose_Logs rather than incremented as a
 * running counter — a counter would drift the moment a reading is edited or
 * deleted, whereas recomputing always matches what the patient can actually see.
 * The stored copy exists so other roles can read it without replaying the logs.
 */
export async function syncGamification(userId: string, stats: WellnessStats, badges: Badge[], earned: EarnedBadge[]) {
  await setDoc(doc(db, 'Gamification', userId), {
    user_id: userId,
    streak_count: stats.streak,
    total_points: stats.points,
    updated_at: serverTimestamp(),
  }, { merge: true });

  const earnedIds = new Set(earned.map((item) => item.badgeId));
  const newlyEarned = badges.filter((badge) => !earnedIds.has(badge.id) && hasQualified(badge, stats));
  if (!newlyEarned.length) return [];

  // Guard against double-awarding if two screens sync at once.
  const existing = await getDocs(query(collection(db, 'User_Badges'), where('user_id', '==', userId)));
  const alreadyThere = new Set(existing.docs.map((document) => String(document.data().badge_id ?? '')));
  const toAward = newlyEarned.filter((badge) => !alreadyThere.has(badge.id));

  await Promise.all(toAward.map((badge) => addDoc(collection(db, 'User_Badges'), {
    user_id: userId,
    badge_id: badge.id,
    earned_at: serverTimestamp(),
  })));
  return toAward;
}
