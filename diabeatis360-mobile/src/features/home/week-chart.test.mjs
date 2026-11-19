// Unit tests for the weekly chart's numbers (src/features/home/week-chart.ts, QA DOC-010). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bucketCurrentWeek, chartScale } from './week-chart.ts';

// Wednesday 18 November 2026; the week runs Monday 16 to Sunday 22.
const now = new Date(2026, 10, 18, 21, 0);
const reading = (readingMgdl, interpretation, day, hour) => ({ readingMgdl, interpretation, loggedAt: new Date(2026, 10, day, hour) });

// The QA run's qa-patient-1: 120 on Monday; 262 (critical), 110 and 150 on Tuesday.
const qaWeek = [
  reading(120, 'normal', 16, 8),
  reading(262, 'critical', 17, 15),
  reading(110, 'normal', 17, 7),
  reading(150, 'high', 17, 20),
];

test('a critical reading is no longer averaged away: the day keeps its highest and its critical readings', () => {
  const { days } = bucketCurrentWeek(qaWeek, now);
  const tuesday = days[1];
  assert.equal(tuesday.value, 174, 'the average is still there (the line)');
  assert.equal(tuesday.low, 110);
  assert.equal(tuesday.high, 262);
  assert.deepEqual(tuesday.critical, [262]);
  assert.deepEqual([days[0].value, days[0].low, days[0].high, days[0].critical], [120, 120, 120, []]);
  assert.deepEqual([days[2].value, days[2].low, days[2].high, days[2].critical], [null, null, null, []], 'a day with no reading stays empty');
});

test('the week: average, lowest, highest, and its critical readings newest first', () => {
  const later = reading(48, 'critical', 18, 6);
  const week = bucketCurrentWeek([...qaWeek, later], now);
  assert.equal(week.lowest, 48);
  assert.equal(week.highest, 262);
  assert.deepEqual(week.criticalReadings.map((entry) => entry.readingMgdl), [48, 262]);
  assert.equal(bucketCurrentWeek(qaWeek, now).average, 161);
});

test('readings outside this calendar week, or with no time, are left out', () => {
  const week = bucketCurrentWeek([reading(300, 'critical', 15, 10), { readingMgdl: 400, interpretation: 'critical', loggedAt: null }], now);
  assert.deepEqual([week.average, week.lowest, week.highest, week.criticalReadings.length], [null, null, null, 0]);
});

test('the scale reaches the real highest reading (no more 200 cap) and shows the critical-high line', () => {
  const scale = chartScale(bucketCurrentWeek(qaWeek, now).days, 54, 250);
  assert.deepEqual(scale, { min: 100, max: 280, thresholds: [250] });
});

test('the scale shows the critical-low line only when the scale reaches it, and needs two days of readings', () => {
  const low = chartScale(bucketCurrentWeek([reading(48, 'critical', 16, 6), reading(95, 'normal', 17, 7)], now).days, 54, 250);
  assert.deepEqual(low, { min: 40, max: 100, thresholds: [54] });
  assert.equal(chartScale(bucketCurrentWeek([reading(262, 'critical', 17, 15)], now).days, 54, 250), null);
});
