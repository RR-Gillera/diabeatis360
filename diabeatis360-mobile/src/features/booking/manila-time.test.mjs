// Unit tests for booking times in Philippine time (DECISIONS.md D26). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPastSlot, isSameManilaDay, manilaInstant, manilaParts, manilaSlotLabel, manilaToday, parseSlotLabel, slotInstant } from './manila-time.ts';

test('a Philippine date and time is UTC minus 8 hours', () => {
  assert.equal(manilaInstant(2026, 9, 18, 9, 30).toISOString(), '2026-10-18T01:30:00.000Z');
  assert.deepEqual(manilaParts(new Date('2026-10-18T16:30:00Z')), { year: 2026, month: 9, day: 19, hour: 0, minute: 30 });
});

test('slot labels', () => {
  assert.deepEqual(parseSlotLabel('09:30 AM'), { hour: 9, minute: 30 });
  assert.deepEqual(parseSlotLabel('12:00 PM'), { hour: 12, minute: 0 });
  assert.deepEqual(parseSlotLabel('12:30 AM'), { hour: 0, minute: 30 });
  assert.equal(parseSlotLabel('soon'), null);
  assert.equal(manilaSlotLabel(new Date('2026-10-18T05:00:00Z')), '01:00 PM');
  assert.equal(manilaSlotLabel(new Date('2026-10-18T01:30:00Z')), '09:30 AM');
});

test('a slot that already started is past; a later one is not (the QA AP-02 case: 09:30 AM at 12:35 PM)', () => {
  const day = new Date(2026, 9, 18);
  const now = new Date('2026-10-18T04:35:00Z'); // 12:35 PM in the Philippines
  assert.equal(isPastSlot(day, '09:30 AM', now), true);
  assert.equal(isPastSlot(day, '12:30 PM', now), true);
  assert.equal(isPastSlot(day, '01:00 PM', now), false);
  assert.equal(isPastSlot(new Date(2026, 9, 19), '09:00 AM', now), false);
  assert.equal(slotInstant(day, '01:00 PM').toISOString(), '2026-10-18T05:00:00.000Z');
});

test('"today" and same-day checks follow the Philippine date, not UTC', () => {
  const lateEvening = new Date('2026-10-18T17:00:00Z'); // 1:00 AM on 19 October in the Philippines
  const today = manilaToday(lateEvening);
  assert.deepEqual([today.getFullYear(), today.getMonth(), today.getDate()], [2026, 9, 19]);
  assert.equal(isSameManilaDay(lateEvening, new Date(2026, 9, 19)), true);
  assert.equal(isSameManilaDay(lateEvening, new Date(2026, 9, 18)), false);
});
