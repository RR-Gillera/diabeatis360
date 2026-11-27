// Unit tests for the doctor's Blood Sugar Insights summary (DECISIONS D50). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareLatest } from './reading-insight.ts';

const now = new Date(2026, 10, 19, 9, 0);
const hoursAgo = (hours) => new Date(now.getTime() - hours * 3600000);

test('the newest reading is compared with the same kind of reading from the 7 days before it', () => {
  const readings = [
    { readingMgdl: 150, context: 'after_meal', loggedAt: hoursAgo(30) },
    { readingMgdl: 140, context: 'before_meal', loggedAt: hoursAgo(1) },
    { readingMgdl: 170, context: 'before_meal', loggedAt: hoursAgo(24) },
    { readingMgdl: 150, context: 'before_meal', loggedAt: hoursAgo(48) },
    { readingMgdl: 300, context: 'before_meal', loggedAt: hoursAgo(24 * 9) },
  ];
  const result = compareLatest(readings);
  assert.equal(result.latest.readingMgdl, 140, 'the newest by time, whatever the list order');
  // The other before-meal readings in the week are 170 and 150 (average 160); the after-meal one and the 9-day-old one are left out.
  assert.deepEqual(result.comparison, { kind: 'compare', percent: 13, direction: 'lower', average: 160, count: 2 });
});

test('higher, the same, and nothing to compare with', () => {
  assert.equal(compareLatest([
    { readingMgdl: 132, context: 'before_meal', loggedAt: hoursAgo(1) },
    { readingMgdl: 120, context: 'before_meal', loggedAt: hoursAgo(25) },
  ]).comparison.direction, 'higher');
  assert.equal(compareLatest([
    { readingMgdl: 120, context: 'before_meal', loggedAt: hoursAgo(1) },
    { readingMgdl: 120, context: 'before_meal', loggedAt: hoursAgo(25) },
  ]).comparison.direction, 'same');
  assert.deepEqual(compareLatest([
    { readingMgdl: 118, context: 'before_meal', loggedAt: hoursAgo(1) },
    { readingMgdl: 156, context: 'after_meal', loggedAt: hoursAgo(5) },
  ]).comparison, { kind: 'first' });
  assert.equal(compareLatest([]), null);
  assert.equal(compareLatest([{ readingMgdl: 120, context: 'before_meal', loggedAt: null }]), null, 'a reading with no time cannot be placed');
});
