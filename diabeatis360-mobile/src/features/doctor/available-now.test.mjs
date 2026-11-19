// Unit tests for "Available now" on the doctor's dashboard. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { manilaInstant } from '../booking/manila-time.ts';
import { isAvailableAt } from './available-now.ts';

const MORNING = { start: '09:00 AM', end: '12:00 PM' };
const AFTERNOON = { start: '02:00 PM', end: '05:00 PM' };
const week = (byDay) => [0, 1, 2, 3, 4, 5, 6].map((day) => byDay[day] ?? []);
const custom = (availableDays, weeklyHours) => ({ availabilityMode: 'custom', availableDays, weeklyHours });
// 2026-10-26 is a Monday; times are Philippine time, whatever zone the test host is in.
const monday = (hour, minute = 0) => manilaInstant(2026, 9, 26, hour, minute);
const tuesday = (hour, minute = 0) => manilaInstant(2026, 9, 27, hour, minute);

test('Available 24/7 is available at any hour', () => {
  assert.equal(isAvailableAt({ availabilityMode: 'always', availableDays: [], weeklyHours: week({}) }, monday(3)), true);
});

test('custom hours: only on a working day, inside that day\'s own slots, end time not included', () => {
  const doctor = custom([0, 1], week({ 0: [MORNING], 1: [AFTERNOON] }));
  assert.equal(isAvailableAt(doctor, monday(9)), true);
  assert.equal(isAvailableAt(doctor, monday(11, 59)), true);
  assert.equal(isAvailableAt(doctor, monday(12)), false, 'the end of a slot is not included');
  assert.equal(isAvailableAt(doctor, monday(8, 59)), false);
  assert.equal(isAvailableAt(doctor, monday(15)), false, 'Monday has no afternoon slot');
  assert.equal(isAvailableAt(doctor, tuesday(15)), true, 'Tuesday has its own afternoon slot');
  assert.equal(isAvailableAt(doctor, manilaInstant(2026, 9, 25, 10, 0)), false, 'Sunday is not a working day');
});

test('a doctor who never set hours gets the default (every day, 8 AM to 6 PM), like the patient\'s picker', () => {
  assert.equal(isAvailableAt(custom([], week({})), monday(17, 30)), true);
  assert.equal(isAvailableAt(custom([], week({})), monday(18)), false);
});
