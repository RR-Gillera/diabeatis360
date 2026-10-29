// The membership tier shown on Profile (Figma "BRONZE MEMBER" badge; DECISIONS.md D31). It comes only from wellness
// points (gamification-service.ts: 5 points per reading logged + 2 per day of the current streak), so it rewards
// steady logging. It is NOT the paid plan: Free or Premium is shown separately. No app imports, so npm test checks it.

export type MemberTier = 'Bronze' | 'Silver' | 'Gold';

/** Points needed to reach each tier. Three readings a day earn about 450 points a month. */
export const TIER_START: Record<MemberTier, number> = { Bronze: 0, Silver: 500, Gold: 1500 };

const ORDER: MemberTier[] = ['Bronze', 'Silver', 'Gold'];

export function memberTier(points: number): { tier: MemberTier; next: MemberTier | null; pointsToNext: number } {
  const safe = Number.isFinite(points) && points > 0 ? Math.floor(points) : 0;
  const tier = [...ORDER].reverse().find((name) => safe >= TIER_START[name]) ?? 'Bronze';
  const next = ORDER[ORDER.indexOf(tier) + 1] ?? null;
  return { tier, next, pointsToNext: next ? TIER_START[next] - safe : 0 };
}

/** 42 -> "42", 1234 -> "1.2k", 15000 -> "15k" (Figma's stat tiles). */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value) || value < 1000) return String(Math.max(0, Math.round(value || 0)));
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.floor(thousands) : Math.floor(thousands * 10) / 10}k`;
}
