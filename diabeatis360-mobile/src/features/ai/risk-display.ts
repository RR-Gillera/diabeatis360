// How the risk screen shows the server's result (DECISIONS.md D51). The level and the factors come from the fixed rule
// in functions/lib/risk.js; this file only turns them into words and colours in the person's language. No Firebase or
// React, so plain Node tests it (risk-display.test.mjs).
import { translate, type Language, type MessageKey } from '@/i18n/translate';

import type { RiskFactor, RiskLevel } from './types';

/** The colour of each level: green, amber, red (the same family as the blood sugar classes). */
export const RISK_COLORS: Record<RiskLevel, string> = { low: '#2E7D32', moderate: '#D97706', high: '#DC2626' };

/** How far round the gauge the needle sits: the score out of the maximum, never quite empty. */
export function gaugeFraction(score: number, max: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return 0.06;
  return Math.max(0.06, Math.min(1, score / max));
}

/** The point on a half circle (left to right over the top) at `fraction`, for the gauge's SVG arc. */
export function arcPoint(fraction: number, cx: number, cy: number, radius: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: Math.round((cx + radius * Math.cos(angle)) * 100) / 100, y: Math.round((cy - radius * Math.sin(angle)) * 100) / 100 };
}

/** Prediabetes is about progressing to type 2 diabetes; Type 1 and Type 2 are about blood sugar control (Objective 3c). */
export function riskIntroKey(diabetesType: string): MessageKey {
  return diabetesType === 'Prediabetes' ? 'risk.intro.pre' : 'risk.intro.diabetes';
}

export type FactorTone = 'good' | 'watch' | 'bad' | 'neutral';

/** The pill colour of a factor: what added to the score is "watch" (1 point) or "bad" (2), the rest good or neutral. */
export function factorTone(factor: RiskFactor): FactorTone {
  if (factor.points >= 2) return 'bad';
  if (factor.points === 1) return 'watch';
  return factor.status === 'unknown' ? 'neutral' : 'good';
}

/** The factor's title, its status pill and a one-line detail with its numbers, in the person's language. */
export function factorText(factor: RiskFactor, language: Language) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key as MessageKey, vars);
  const value = factor.value ?? {};
  let detail = '';
  if (factor.key === 'in_range') detail = t('risk.detail.in_range', { percent: value.percent ?? 0 });
  if (factor.key === 'dangerous') detail = t('risk.detail.dangerous', { critical: value.critical ?? 0, low: value.low ?? 0 });
  if (factor.key === 'average') {
    detail = t(value.context === 'after_meal' ? 'risk.detail.averageAfter' : 'risk.detail.average', { mgdl: value.mgdl ?? 0, limit: value.limit ?? 0 });
  }
  if (factor.key === 'trend') {
    detail = value.percent === null || value.percent === undefined
      ? t('risk.detail.trendUnknown')
      : t('risk.detail.trend', { change: `${value.percent > 0 ? '+' : ''}${value.percent}%` });
  }
  if (factor.key === 'activity') detail = value.level ? t('risk.detail.activity', { level: value.level }) : t('risk.status.activity.unknown');
  return {
    title: t(`risk.factor.${factor.key}`),
    status: t(`risk.status.${factor.key}.${factor.status}`),
    detail,
  };
}
