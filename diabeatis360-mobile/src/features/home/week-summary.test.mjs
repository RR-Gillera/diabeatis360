// Unit tests for Home's weekly summary (src/features/home/week-summary.ts, DECISIONS.md D34). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { weekSummary } from './week-summary.ts';

const now = new Date(2026, 9, 29, 15, 0); // Oct 29, 2026, 3:00 PM
const daysAgo = (days, hour = 9) => { const date = new Date(now); date.setDate(date.getDate() - days); date.setHours(hour, 0, 0, 0); return date; };
const reading = (mg, interpretation, days) => ({ readingMgdl: mg, interpretation, loggedAt: daysAgo(days) });

test('no readings this week: the "log a reading" message, no average', () => {
  assert.deepEqual(weekSummary([], now), { count: 0, inRange: 0, anyCritical: false, average: null, insight: 'none' });
  assert.equal(weekSummary([reading(110, 'normal', 7)], now).insight, 'none', 'a reading from 7 days ago is outside the week');
});

test('only the last 7 days count (today and the 6 days before)', () => {
  const summary = weekSummary([reading(100, 'normal', 0), reading(120, 'normal', 6), reading(300, 'critical', 7)], now);
  assert.equal(summary.count, 2);
  assert.equal(summary.average, 110);
  assert.equal(summary.anyCritical, false);
});

test('a critical reading this week always gives the critical message, never "keep it up"', () => {
  const entries = [reading(110, 'normal', 0), reading(115, 'normal', 1), reading(105, 'normal', 2), reading(260, 'critical', 3)];
  const summary = weekSummary(entries, now);
  assert.equal(summary.insight, 'critical');
  assert.equal(summary.inRange, 3);
});

test('70% or more in range is "good", less is "mixed"', () => {
  const good = [reading(110, 'normal', 0), reading(120, 'normal', 1), reading(100, 'normal', 2), reading(190, 'high', 3)];
  assert.equal(weekSummary(good, now).insight, 'good');
  const mixed = [reading(110, 'normal', 0), reading(200, 'high', 1), reading(65, 'low', 2)];
  assert.equal(weekSummary(mixed, now).insight, 'mixed');
});

test('a reading with no time is ignored', () => {
  assert.equal(weekSummary([{ readingMgdl: 110, interpretation: 'normal', loggedAt: null }], now).count, 0);
});
