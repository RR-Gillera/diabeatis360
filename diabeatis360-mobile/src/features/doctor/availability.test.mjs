// Unit tests for a doctor's availability: Available 24/7 or custom hours (DECISIONS D43). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toAvailabilityMode } from '../../constants/enums.ts';
import { manilaSlotLabel, parseSlotLabel, slotInstant } from '../booking/manila-time.ts';
import { ALL_DAYS, DAY_PERIODS, allDaySlots, bookableSchedule, daysText, hasOwnHours, hoursText, periodOf, sameAvailability, usableRanges } from './availability.ts';

const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MORNING = { start: '09:00 AM', end: '12:00 PM' };
const EVENING = { start: '07:00 PM', end: '09:00 PM' };
const custom = (availableDays, availableRanges) => ({ availabilityMode: 'custom', availableDays, availableRanges });
const always = (availableDays = [], availableRanges = []) => ({ availabilityMode: 'always', availableDays, availableRanges });

test('only the exact code "always" means 24/7; nothing stored or anything else is custom hours', () => {
  assert.equal(toAvailabilityMode('always'), 'always');
  for (const value of [undefined, null, '', 'custom', 'ALWAYS', 'Always ', true, 24, {}]) assert.equal(toAvailabilityMode(value), 'custom');
});

test('a whole day is 48 half-hour slots, from 12:00 AM to 11:30 PM', () => {
  const slots = allDaySlots();
  assert.equal(slots.length, 48);
  assert.equal(slots[0], '12:00 AM');
  assert.equal(slots[1], '12:30 AM');
  assert.equal(slots[24], '12:00 PM');
  assert.equal(slots[47], '11:30 PM');
  assert.equal(new Set(slots).size, 48, 'no time is listed twice');
});

test('every 24/7 slot can become a booking: it parses, and the booked moment reads back as the same label', () => {
  // The picker greys out a taken time by comparing its label with the label of the stored moment (manilaSlotLabel).
  const day = new Date(2026, 10, 20);
  for (const label of allDaySlots()) {
    assert.ok(parseSlotLabel(label), `${label} parses`);
    assert.equal(manilaSlotLabel(slotInstant(day, label)), label);
  }
});

test('24/7: every day and every slot, whatever days and hours are still stored from before', () => {
  const schedule = bookableSchedule(always([0, 1], [MORNING]));
  assert.deepEqual(schedule.days, ALL_DAYS);
  assert.equal(schedule.slots.length, 48);
  assert.deepEqual(schedule.hours, []);
});

test('custom hours: only the doctor\'s days and the slots inside their time windows', () => {
  const schedule = bookableSchedule(custom([0, 2, 4], [MORNING, EVENING]));
  assert.deepEqual(schedule.days, [0, 2, 4]);
  assert.deepEqual(schedule.hours, [MORNING, EVENING]);
  assert.deepEqual(schedule.slots, ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM']);
});

test('custom hours with nothing chosen (or a profile not loaded yet): the default, every day 8:00 AM to 6:00 PM', () => {
  for (const nothing of [custom([], []), null]) {
    const schedule = bookableSchedule(nothing);
    assert.deepEqual(schedule.days, ALL_DAYS);
    assert.deepEqual(schedule.hours, [{ start: '08:00 AM', end: '06:00 PM' }]);
    assert.equal(schedule.slots.length, 20);
    assert.equal(schedule.slots[0], '08:00 AM');
    assert.equal(schedule.slots[19], '05:30 PM');
  }
});

test('custom hours with only one half chosen: the default fills in the other half only', () => {
  const daysOnly = bookableSchedule(custom([5, 6], []));
  assert.deepEqual(daysOnly.days, [5, 6]);
  assert.equal(daysOnly.slots.length, 20, 'default hours');
  const hoursOnly = bookableSchedule(custom([], [EVENING]));
  assert.deepEqual(hoursOnly.days, ALL_DAYS, 'default days');
  assert.deepEqual(hoursOnly.slots, ['07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM']);
});

test('a time window that fits no slot does not count as hours set', () => {
  const tooShort = { start: '09:00 AM', end: '09:20 AM' };
  const backwards = { start: '05:00 PM', end: '09:00 AM' };
  const unreadable = { start: 'nine', end: 'ten' };
  assert.deepEqual(usableRanges([tooShort, MORNING, backwards, unreadable]), [MORNING]);
  assert.equal(hasOwnHours(custom([0], [MORNING])), true);
  assert.equal(hasOwnHours(custom([0], [tooShort])), false, 'a day but no usable window');
  assert.equal(hasOwnHours(custom([], [MORNING])), false, 'a window but no day');
  assert.equal(hasOwnHours(custom([], [])), false);
  // The unusable window falls back to the default hours instead of leaving the doctor with no slots at all.
  assert.equal(bookableSchedule(custom([0], [tooShort])).slots.length, 20);
});

test('"saved or not": the same setting, a changed mode, changed days, changed hours', () => {
  assert.equal(sameAvailability(custom([0, 1], [MORNING]), custom([1, 0], [MORNING])), true, 'the order of the days does not matter');
  assert.equal(sameAvailability(custom([0, 1], [MORNING]), custom([0], [MORNING])), false);
  assert.equal(sameAvailability(custom([0, 1], [MORNING]), custom([0, 1], [EVENING])), false);
  assert.equal(sameAvailability(custom([0, 1], [MORNING]), custom([0, 1], [MORNING, EVENING])), false);
  assert.equal(sameAvailability(custom([0, 1], [MORNING]), always([0, 1], [MORNING])), false);
  assert.equal(sameAvailability(always([0], [MORNING]), always([3, 4], [EVENING])), true, 'with 24/7 the stored days and hours are not used');
});

test('days are said shortly: every day, a run of three or more, otherwise a list', () => {
  assert.equal(daysText([0, 1, 2, 3, 4, 5, 6], NAMES, 'Every day'), 'Every day');
  assert.equal(daysText([4, 0, 2, 1, 3], NAMES, 'Every day'), 'Mon – Fri', 'sorted first');
  assert.equal(daysText([4, 5, 6], NAMES, 'Every day'), 'Fri – Sun');
  assert.equal(daysText([5, 6], NAMES, 'Every day'), 'Sat, Sun', 'two days are a list, not a run');
  assert.equal(daysText([0, 2, 4], NAMES, 'Every day'), 'Mon, Wed, Fri');
  assert.equal(daysText([0, 1, 2, 4], NAMES, 'Every day'), 'Mon, Tue, Wed, Fri', 'a gap makes it a list');
  assert.equal(daysText([2, 2], NAMES, 'Every day'), 'Wed', 'a repeated day is said once');
  assert.equal(daysText([], NAMES, 'Every day'), '');
});

test('hours are shown without the leading zero', () => {
  assert.equal(hoursText([MORNING, EVENING]), '9:00 AM – 12:00 PM, 7:00 PM – 9:00 PM');
  assert.equal(hoursText([{ start: '10:30 AM', end: '12:00 PM' }]), '10:30 AM – 12:00 PM', 'only a leading zero is removed');
  assert.equal(hoursText([]), '');
});

test('the patient\'s picker groups slots into four parts of the day', () => {
  assert.equal(periodOf('12:00 AM'), 'early');
  assert.equal(periodOf('05:30 AM'), 'early');
  assert.equal(periodOf('06:00 AM'), 'morning');
  assert.equal(periodOf('11:30 AM'), 'morning');
  assert.equal(periodOf('12:00 PM'), 'afternoon');
  assert.equal(periodOf('05:30 PM'), 'afternoon');
  assert.equal(periodOf('06:00 PM'), 'evening');
  assert.equal(periodOf('11:30 PM'), 'evening');
  // A 24/7 day splits evenly, and every slot lands in exactly one group.
  const counts = Object.fromEntries(DAY_PERIODS.map((period) => [period, allDaySlots().filter((slot) => periodOf(slot) === period).length]));
  assert.deepEqual(counts, { early: 12, morning: 12, afternoon: 12, evening: 12 });
});
