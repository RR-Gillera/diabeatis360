// Unit tests for the Consultation Summary's duration (Figma P-25). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { callClock, durationLabel } from './consultation-format.ts';

test('the call clock reads like the frames', () => {
  assert.equal(callClock(312), '05:12');
  assert.equal(callClock(0), '00:00');
  assert.equal(callClock(59.9), '00:59');
  assert.equal(callClock(3725), '1:02:05');
  assert.equal(callClock(-4), '00:00');
});

test('the duration reads like the frame and is hidden when it cannot be known', () => {
  const start = new Date(2026, 9, 22, 10, 0);
  const after = (minutes) => new Date(start.getTime() + minutes * 60000);
  assert.equal(durationLabel(start, after(18)), '18 minutes');
  assert.equal(durationLabel(start, after(1)), '1 minute');
  assert.equal(durationLabel(start, after(0.2)), 'Less than a minute');
  assert.equal(durationLabel(start, after(65)), '1 hr 5 min');
  assert.equal(durationLabel(start, after(120)), '2 hr');
  assert.equal(durationLabel(null, after(5)), null);
  assert.equal(durationLabel(start, null), null);
  assert.equal(durationLabel(after(10), start), null, 'an end before the start is not shown');
});
