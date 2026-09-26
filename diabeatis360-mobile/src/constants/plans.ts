// Free-plan limits (manuscript business model, DECISIONS.md D5). Premium is unlimited.
// The same numbers are enforced server-side by the AI Cloud Functions (IMPLEMENTATION_PLAN item 13a);
// the app reads them here only to show how much of today's allowance is left.
export const FREE_LIMITS = { ai: 2, scan: 3 } as const;

export type LimitedFeature = keyof typeof FREE_LIMITS;

/** A comparison cell: true = included, false = not included, string = shown as text (e.g. "3 per day"). */
export type ComparisonCell = boolean | string;

// Only lists what the app really enforces. The Figma frame also lists "24/7 Doc Chat" and "Expert Reports" as
// Premium-only, but the manuscript keeps the doctor module free and those reports are not built.
export const PLAN_COMPARISON: { label: string; free: ComparisonCell; premium: ComparisonCell }[] = [
  { label: 'Glucose Logging', free: true, premium: true },
  { label: 'AI Meal & Exercise Tips', free: `${FREE_LIMITS.ai} per day`, premium: 'Unlimited' },
  { label: 'Nutrition Label Scans', free: `${FREE_LIMITS.scan} per day`, premium: 'Unlimited' },
];
