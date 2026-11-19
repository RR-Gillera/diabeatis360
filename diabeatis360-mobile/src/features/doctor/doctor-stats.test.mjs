// Unit tests for the doctor screens' numbers (DECISIONS D24). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REQUEST_TABS, ageFrom, dailyEarnings, dashboardStats, filterRequests, requestTabFor, startsIn, weeklyInsights } from './doctor-stats.ts';
import { manilaInstant } from '../booking/manila-time.ts';

test('requests are split like the frame; finished ones belong to History', () => {
  assert.deepEqual(REQUEST_TABS.map((tab) => tab.label), ['Pending', 'Accepted', 'Declined']);
  assert.equal(requestTabFor('pending'), 'pending');
  assert.equal(requestTabFor('confirmed'), 'accepted');
  assert.equal(requestTabFor('declined'), 'declined');
  assert.equal(requestTabFor('cancelled'), 'declined');
  assert.equal(requestTabFor('completed'), null);
});

test('dashboard counts and earnings (fee minus the 15% commission, finished consultations paid online only, D37)', () => {
  // "Today" is the Philippine day (D26), so the test says its times in Philippine time too, whatever zone the test host is in.
  const now = manilaInstant(2026, 9, 24, 9, 0);
  const at = (day, hour) => manilaInstant(2026, 9, day, hour, 0);
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
  assert.equal(stats.earnings, 680, 'only the finished consultation paid online counts; on-site (paid at the clinic) and unpaid ones do not');
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

test('the earnings line: one total per Philippine day for the last 7 days, same rule as Total Earnings', () => {
  const now = manilaInstant(2026, 9, 24, 9, 0);
  const at = (day, hour) => manilaInstant(2026, 9, day, hour, 0);
  const bookings = [
    { status: 'completed', scheduledAt: at(24, 8), fee: 500, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(24, 7), fee: 500, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(20, 9), fee: 800, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(20, 10), fee: 300, paymentStatus: 'onsite' },
    { status: 'confirmed', scheduledAt: at(22, 9), fee: 500, paymentStatus: 'paid' },
    { status: 'completed', scheduledAt: at(10, 9), fee: 900, paymentStatus: 'paid' },
  ];
  // Oct 18 … Oct 24. Oct 10 is older than a week; on-site and not-yet-finished consultations are not earnings.
  assert.deepEqual(dailyEarnings(bookings, 0.15, now), [0, 0, 680, 0, 0, 0, 850]);
  assert.equal(dailyEarnings([], 0.15, now).length, 7);
});

test('the "In 15 mins" pill', () => {
  const now = new Date(2026, 9, 24, 9, 45);
  assert.deepEqual(startsIn(new Date(2026, 9, 24, 10, 0), now), { unit: 'minutes', value: 15 });
  assert.deepEqual(startsIn(new Date(2026, 9, 24, 12, 30), now), { unit: 'hours', value: 2 });
  assert.deepEqual(startsIn(new Date(2026, 9, 26, 10, 0), now), { unit: 'days', value: 2 });
  assert.deepEqual(startsIn(new Date(2026, 9, 24, 9, 30), now), { unit: 'now', value: 0 }, 'already started');
});

test('the Requests "Filters" sheet: order and day range in Philippine days', () => {
  const now = manilaInstant(2026, 10, 19, 9, 0);
  const a = { id: 'a', scheduledAt: manilaInstant(2026, 10, 19, 15, 0) };
  const b = { id: 'b', scheduledAt: manilaInstant(2026, 10, 22, 10, 0) };
  const c = { id: 'c', scheduledAt: manilaInstant(2026, 11, 5, 10, 0) };
  const d = { id: 'd', scheduledAt: null };
  const ids = (list) => list.map((entry) => entry.id);
  assert.deepEqual(ids(filterRequests([c, d, a, b], 'soonest', 'all', now)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(filterRequests([c, d, a, b], 'latest', 'all', now)), ['c', 'b', 'a', 'd']);
  assert.deepEqual(ids(filterRequests([c, d, a, b], 'soonest', 'today', now)), ['a']);
  assert.deepEqual(ids(filterRequests([c, d, a, b], 'soonest', 'week', now)), ['a', 'b']);
});
