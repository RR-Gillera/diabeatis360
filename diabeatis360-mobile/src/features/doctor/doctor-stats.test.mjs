// Unit tests for the doctor screens' numbers (DECISIONS D24). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REQUEST_TABS, ageFrom, dashboardStats, requestTabFor, weeklyInsights } from './doctor-stats.ts';

test('requests are split like the frame; finished ones belong to History', () => {
  assert.deepEqual(REQUEST_TABS.map((tab) => tab.label), ['Pending', 'Accepted', 'Declined']);
  assert.equal(requestTabFor('pending'), 'pending');
  assert.equal(requestTabFor('confirmed'), 'accepted');
  assert.equal(requestTabFor('declined'), 'declined');
  assert.equal(requestTabFor('cancelled'), 'declined');
  assert.equal(requestTabFor('completed'), null);
});

test('dashboard counts and earnings (fee minus the 15% commission, paid or on-site finished consultations only)', () => {
  const now = new Date(2026, 9, 24, 9, 0);
  const at = (day, hour) => new Date(2026, 9, day, hour, 0);
  const bookings = [
    { status: 'confirmed', scheduledAt: at(24, 10), fee: 500, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(24, 8), fee: 500, paymentStatus: 'onsite' },
    { status: 'pending', scheduledAt: at(24, 11), fee: 500, paymentStatus: 'unpaid' },
    { status: 'pending', scheduledAt: at(25, 11), fee: 500, paymentStatus: 'unpaid' },
    { status: 'completed', scheduledAt: at(20, 9), fee: 800, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(19, 9), fee: 300, paymentStatus: 'unpaid' },
    { status: 'declined', scheduledAt: at(24, 15), fee: 500, paymentStatus: 'unpaid' },
  ];
  const stats = dashboardStats(bookings, 0.15, now);
  assert.equal(stats.today, 2, 'confirmed or completed today; pending and declined do not count');
  assert.equal(stats.pending, 2);
  assert.equal(stats.completed, 3);
  assert.equal(stats.earnings, 425 + 680, 'unpaid finished consultations earn nothing yet');
});

test('age from a birthdate, counting whether the birthday has passed this year', () => {
  const now = new Date(2026, 9, 17);
  assert.equal(ageFrom(new Date(1981, 2, 14), now), 45);
  assert.equal(ageFrom(new Date(1981, 11, 1), now), 44);
  assert.equal(ageFrom(new Date(2026, 9, 17), now), 0);
  assert.equal(ageFrom(null, now), null);
});

test('weekly insights use only the last 7 days', () => {
  const now = new Date(2026, 9, 17, 12, 0);
  const daysAgo = (days) => new Date(now.getTime() - days * 86400000);
  const readings = [
    { readingMgdl: 100, interpretation: 'normal', loggedAt: daysAgo(1) },
    { readingMgdl: 190, interpretation: 'high', loggedAt: daysAgo(2) },
    { readingMgdl: 110, interpretation: 'normal', loggedAt: daysAgo(3) },
    { readingMgdl: 60, interpretation: 'low', loggedAt: daysAgo(6) },
    { readingMgdl: 400, interpretation: 'critical', loggedAt: daysAgo(9) },
  ];
  assert.deepEqual(weeklyInsights(readings, now), { count: 4, average: 115, inRangePercent: 50, highest: 190, lowest: 60 });
  assert.equal(weeklyInsights([{ readingMgdl: 120, interpretation: 'normal', loggedAt: daysAgo(10) }], now), null);
});
