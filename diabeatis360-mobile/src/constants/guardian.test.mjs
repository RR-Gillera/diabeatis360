// Unit tests for the "For me" / "For my child" age rule (DECISIONS.md D16, UT-005). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ADULT_MIN_AGE, ageOn, birthdateProblem, birthYearsFor, isUnderAdultAge } from './guardian.ts';

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

test('birth years (D41): an account for me starts 18 years back; a child\'s account covers the last 18 years', () => {
  const now = new Date(2026, 10, 8);
  const adult = birthYearsFor('self', now);
  assert.equal(adult[0], 2008);
  assert.equal(adult[adult.length - 1], 1907);
  assert.ok(!adult.includes(2026) && !adult.includes(2009), 'no year that can only give a minor');
  const child = birthYearsFor('minor', now);
  assert.deepEqual([child[0], child[child.length - 1], child.length], [2026, 2008, 19]);
  assert.ok(adult.includes(2008) && child.includes(2008), 'the boundary year is in both: the age check decides');
});

test('birthdateProblem (QA PAT-001): a birthdate must fit the account and must not be in the future', () => {
  const now = new Date(2026, 10, 18, 10, 0);
  assert.equal(birthdateProblem(new Date(1990, 4, 1), 'self', now), null);
  assert.equal(birthdateProblem(new Date(2008, 10, 18), 'self', now), null, 'turns 18 today');
  assert.equal(birthdateProblem(new Date(2026, 0, 1), 'self', now), 'childForSelf', 'the QA case: January 1 of this year on an account for me');
  assert.equal(birthdateProblem(new Date(2008, 10, 19), 'self', now), 'childForSelf', 'turns 18 tomorrow');
  assert.equal(birthdateProblem(new Date(2016, 5, 1), 'minor', now), null);
  assert.equal(birthdateProblem(new Date(2026, 10, 18), 'minor', now), null, 'born today');
  assert.equal(birthdateProblem(new Date(1990, 4, 1), 'minor', now), 'adultForChild');
  assert.equal(birthdateProblem(new Date(2026, 11, 25), 'minor', now), 'future', 'the child list includes this year, so December could be picked');
});
