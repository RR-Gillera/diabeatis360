// Unit tests for the blood sugar trend shared in the consultation chat. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dailyTrend, hasTrend } from './glucose-trend.ts';
import { manilaDayKey, manilaInstant } from '../booking/manila-time.ts';

test('one point per Philippine day, oldest first, averaging that day', () => {
  const now = manilaInstant(2026, 10, 19, 9, 0);
  const readings = [
    { readingMgdl: 120, loggedAt: manilaInstant(2026, 10, 17, 7, 0) },
    { readingMgdl: 140, loggedAt: manilaInstant(2026, 10, 17, 20, 0) },
    { readingMgdl: 142, loggedAt: manilaInstant(2026, 10, 19, 6, 30) },
    { readingMgdl: 300, loggedAt: manilaInstant(2026, 10, 15, 6, 30) }, // too old
    { readingMgdl: 99, loggedAt: null },
  ];
  const points = dailyTrend(readings, now);
  assert.deepEqual(points.map((point) => manilaDayKey(point.day)), ['2026-11-17', '2026-11-18', '2026-11-19']);
  assert.deepEqual(points.map((point) => point.averageMgdl), [130, null, 142]);
  assert.equal(hasTrend(points), true);
});

test('a reading just after midnight in the Philippines counts for that Philippine day', () => {
  const now = manilaInstant(2026, 10, 19, 9, 0);
  const points = dailyTrend([{ readingMgdl: 110, loggedAt: manilaInstant(2026, 10, 19, 0, 15) }], now);
  assert.deepEqual(points.map((point) => point.averageMgdl), [null, null, 110]);
});

test('nothing logged means nothing to share', () => {
  const points = dailyTrend([], manilaInstant(2026, 10, 19, 9, 0));
  assert.equal(points.length, 3);
  assert.equal(hasTrend(points), false);
});
