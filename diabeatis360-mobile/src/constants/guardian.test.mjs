// Unit tests for the "For me" / "For my child" age rule (DECISIONS.md D16, UT-005). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ADULT_MIN_AGE, ageOn, isUnderAdultAge } from './guardian.ts';

test('ageOn: exact birthday today counts the new age', () => {
  assert.equal(ageOn(new Date(2010, 2, 15), new Date(2026, 2, 15)), 16);
});

test('ageOn: the day before a birthday is still the old age', () => {
  assert.equal(ageOn(new Date(2010, 2, 15), new Date(2026, 2, 14)), 15);
});

test('isUnderAdultAge: 17 is under, 18 and 19 are not', () => {
  const now = new Date(2026, 0, 1);
  assert.equal(isUnderAdultAge(new Date(2009, 0, 2), now), true); // turns 17 the next day
  assert.equal(isUnderAdultAge(new Date(2008, 0, 1), now), false); // turns 18 today
  assert.equal(isUnderAdultAge(new Date(2007, 0, 1), now), false);
});

test('ADULT_MIN_AGE is 18 (manuscript Scope & Limitations)', () => {
  assert.equal(ADULT_MIN_AGE, 18);
});
