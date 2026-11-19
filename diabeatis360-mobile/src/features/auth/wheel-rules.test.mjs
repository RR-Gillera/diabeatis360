// Unit tests for the date-wheel rules (src/features/auth/wheel-rules.ts, QA PAT-001). Run with: npm test
// The scrolling itself needs a phone; these pin the decisions the wheel makes.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rowFor, shouldPick, tapAction } from './wheel-rules.ts';

const adultYears = [2008, 2007, 2006];

test('a year that is not in the list shows no row (it used to be -1, read aloud as "undefined")', () => {
  assert.equal(rowFor(adultYears, 2026), null, 'the QA case: 2026 kept while the "For me" list starts at 2008');
  assert.equal(rowFor(adultYears, null), null);
  assert.equal(rowFor(adultYears, 2007), 1);
});

test('a wheel nobody touched picks nothing, even when a scroll event arrives', () => {
  assert.equal(shouldPick(false, 0, 0, null), false, 'the scroll Android sends when the wheel first appears');
  assert.equal(shouldPick(false, 3, 0, null), false);
});

test('once touched, coming to rest on a new row, or on the band row with nothing chosen yet, picks it', () => {
  assert.equal(shouldPick(true, 3, 0, 0), true);
  assert.equal(shouldPick(true, 0, 0, null), true, 'dragged and let go on the first row');
  assert.equal(shouldPick(true, 2, 2, 2), false, 'already the choice: nothing new');
});

test('tapping: another row scrolls there, the band row is picked at once, the chosen row does nothing', () => {
  assert.equal(tapAction(4, 0, null), 'scroll');
  assert.equal(tapAction(0, 0, null), 'pick', 'tapping the highlighted row used to do nothing');
  assert.equal(tapAction(2, 2, 2), 'none');
});
