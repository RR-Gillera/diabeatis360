// Unit tests for weekly challenges and milestones (DECISIONS.md D51). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { challengeBonus, manilaDayKey, manilaWeekKey, milestoneProgress, weeklyChallenges } from './challenges.ts';

// A moment given in Philippine time (UTC+8).
const ph = (text) => new Date(`${text}+08:00`);
const reading = (text, context = 'before_meal') => ({ loggedAt: ph(text), context });

test('days and weeks are Philippine dates, whatever the phone\'s time zone', () => {
  assert.equal(manilaDayKey(ph('2026-11-20T00:30:00')), '2026-11-20'); // 4:30 PM on Nov 19 in UTC
  assert.equal(manilaWeekKey(ph('2026-11-16T00:00:00')), '2026-11-16'); // Monday
  assert.equal(manilaWeekKey(ph('2026-11-22T23:59:00')), '2026-11-16'); // Sunday night is still the same week
  assert.equal(manilaWeekKey(ph('2026-11-23T00:00:00')), '2026-11-23'); // next Monday starts a new week
});

test('no readings: every challenge at zero, no bonus', () => {
  const challenges = weeklyChallenges([], ph('2026-11-20T12:00:00'));
  assert.deepEqual(challenges.map((c) => [c.id, c.value, c.done]), [['log_days', 0, false], ['meal_pairs', 0, false], ['readings', 0, false]]);
  assert.equal(challengeBonus([]), 0);
});

test('logging on 5 different days finishes "log_days" (+30); several readings on one day count as one day', () => {
  const week = ['16', '17', '18', '19', '20'].map((day) => reading(`2026-11-${day}T08:00:00`));
  week.push(reading('2026-11-20T19:00:00'));
  const [logDays] = weeklyChallenges(week, ph('2026-11-21T09:00:00'));
  assert.equal(logDays.value, 5);
  assert.equal(logDays.done, true);
  assert.equal(challengeBonus(week), 30);
});

test('a "meal pair" needs a before-meal AND an after-meal reading on the same day', () => {
  const readings = [
    reading('2026-11-16T07:00:00', 'before_meal'), reading('2026-11-16T09:00:00', 'after_meal'), // pair 1
    reading('2026-11-17T07:00:00', 'before_meal'), reading('2026-11-17T12:00:00', 'before_meal'), // no pair
    reading('2026-11-18T07:00:00', 'before_meal'), reading('2026-11-18T09:00:00', 'after_meal'), // pair 2
    reading('2026-11-19T21:00:00', 'after_meal'), reading('2026-11-20T07:00:00', 'before_meal'), // different days: no pair
  ];
  const pairs = weeklyChallenges(readings, ph('2026-11-20T12:00:00')).find((c) => c.id === 'meal_pairs');
  assert.equal(pairs.value, 2);
  assert.equal(pairs.done, false);
  readings.push(reading('2026-11-20T09:00:00', 'after_meal')); // pair 3
  assert.equal(weeklyChallenges(readings, ph('2026-11-20T12:00:00')).find((c) => c.id === 'meal_pairs').done, true);
});

test('14 readings finish "readings" (+20); the shown value stops at the goal', () => {
  const readings = Array.from({ length: 16 }, (_, i) => reading(`2026-11-17T${String(6 + i).padStart(2, '0')}:00:00`));
  const count = weeklyChallenges(readings, ph('2026-11-18T00:00:00')).find((c) => c.id === 'readings');
  assert.equal(count.value, 14);
  assert.equal(count.done, true);
  assert.equal(challengeBonus(readings), 20);
});

test('a new week starts again at zero, but last week\'s bonus is kept', () => {
  const lastWeek = ['16', '17', '18', '19', '20'].map((day) => reading(`2026-11-${day}T08:00:00`));
  const challenges = weeklyChallenges(lastWeek, ph('2026-11-23T08:00:00'));
  assert.equal(challenges.find((c) => c.id === 'log_days').value, 0);
  assert.equal(challengeBonus(lastWeek), 30);
});

test('each challenge pays once per week, and weeks add up', () => {
  const twoWeeks = [
    ...['16', '17', '18', '19', '20', '21', '22'].map((day) => reading(`2026-11-${day}T08:00:00`)), // 7 days: log_days once
    ...['23', '24', '25', '26', '27'].map((day) => reading(`2026-11-${day}T08:00:00`)),
  ];
  assert.equal(challengeBonus(twoWeeks), 60);
});

test('readings without a time are ignored', () => {
  assert.equal(challengeBonus([{ loggedAt: null, context: 'before_meal' }]), 0);
});

test('milestone progress runs from the tier start to the next tier, and is full at the top tier', () => {
  assert.equal(milestoneProgress(0, 0, 500), 0);
  assert.equal(milestoneProgress(250, 0, 500), 0.5);
  assert.equal(milestoneProgress(1000, 500, 1500), 0.5);
  assert.equal(milestoneProgress(2000, 1500, null), 1);
  assert.equal(milestoneProgress(-5, 0, 500), 0);
});
