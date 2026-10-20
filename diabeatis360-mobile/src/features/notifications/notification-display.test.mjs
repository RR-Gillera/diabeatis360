// Unit tests for how notifications are filtered, titled and timed (Figma P-22).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NOTIFICATION_FILTERS, matchesFilter, notificationTitle, shortTime } from './notification-display.ts';

test('the four tabs are the ones in the frame, in order', () => {
  assert.deepEqual(NOTIFICATION_FILTERS.map((tab) => tab.label), ['All', 'Appointments', 'Messages', 'Alerts']);
});

test('each kind of notification lands under the right tab, and All shows everything', () => {
  const kinds = ['glucose_alert', 'booking_update', 'message', 'reminder', 'announcement', 'guardian_verification', 'doctor_verification'];
  for (const kind of kinds) assert.equal(matchesFilter(kind, 'all'), true, kind);
  assert.deepEqual(kinds.filter((kind) => matchesFilter(kind, 'appointments')), ['booking_update']);
  assert.deepEqual(kinds.filter((kind) => matchesFilter(kind, 'messages')), ['message']);
  assert.deepEqual(kinds.filter((kind) => matchesFilter(kind, 'alerts')), ['glucose_alert', 'guardian_verification', 'doctor_verification']);
});

test('every kind has a readable title', () => {
  assert.equal(notificationTitle('glucose_alert'), 'Out-of-range reading');
  assert.equal(notificationTitle('message'), 'New message');
  assert.equal(notificationTitle('something-new'), 'Notification');
});

test('times read like the frame: minutes, hours today, Yesterday, then the date', () => {
  const now = new Date(2026, 9, 17, 15, 0);
  assert.equal(shortTime(null, now), 'Just now');
  assert.equal(shortTime(new Date(2026, 9, 17, 14, 59, 40), now), 'Just now');
  assert.equal(shortTime(new Date(2026, 9, 17, 14, 58), now), '2m');
  assert.equal(shortTime(new Date(2026, 9, 17, 12, 0), now), '3h');
  assert.equal(shortTime(new Date(2026, 9, 17, 0, 5), now), '14h');
  assert.equal(shortTime(new Date(2026, 9, 16, 23, 0), now), 'Yesterday');
  assert.equal(shortTime(new Date(2026, 9, 15, 9, 0), now), 'Oct 15');
  assert.equal(shortTime(new Date(2025, 11, 31, 9, 0), now), 'Dec 31, 2025');
});
