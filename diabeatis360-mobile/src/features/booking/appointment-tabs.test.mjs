// Unit tests for the My Appointments tabs and avatar initials (Figma P-21). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { APPOINTMENT_TABS, initialsOf, tabFor } from './appointment-tabs.ts';

test('the four tabs are the ones in the frame, in order', () => {
  assert.deepEqual(APPOINTMENT_TABS.map((tab) => tab.label), ['Upcoming', 'Pending', 'Completed', 'Declined']);
});

test('every booking status lands in exactly one tab', () => {
  assert.equal(tabFor('confirmed'), 'upcoming');
  assert.equal(tabFor('pending'), 'pending');
  assert.equal(tabFor('completed'), 'completed');
  assert.equal(tabFor('declined'), 'declined');
  assert.equal(tabFor('cancelled'), 'declined');
  assert.equal(tabFor('something-else'), null);
});

test('initials skip the doctor title and use the first and last name', () => {
  assert.equal(initialsOf('Dr. John Smith'), 'JS');
  assert.equal(initialsOf('dra maria clara santos'), 'MS');
  assert.equal(initialsOf('Maria'), 'M');
  assert.equal(initialsOf('  '), '?');
  assert.equal(initialsOf(null), '?');
});
