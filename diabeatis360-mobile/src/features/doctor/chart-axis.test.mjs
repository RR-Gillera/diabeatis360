// Unit tests for the doctor's 7-day chart axis (DECISIONS D50). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { niceAxis } from './chart-axis.ts';

test('blood sugar: a round range just around the week, like the frame\'s 80–140', () => {
  assert.deepEqual(niceAxis([110, 145, 128, 115, 118, 132, 118], false), { bottom: 100, top: 160, ticks: [100, 120, 140, 160] });
  assert.deepEqual(niceAxis([120], false), { bottom: 120, top: 140, ticks: [120, 140] }, 'one reading still gets a range');
});

test('earnings: from ₱0 up, even for a week with nothing earned', () => {
  assert.deepEqual(niceAxis([1000, 1500, 500, 2500, 2000, 0, 0], true), { bottom: 0, top: 3000, ticks: [0, 1000, 2000, 3000] });
  assert.deepEqual(niceAxis([0, 0, 0], true), { bottom: 0, top: 500, ticks: [0, 500] });
  assert.deepEqual(niceAxis([], true), { bottom: 0, top: 500, ticks: [0, 500] });
});
