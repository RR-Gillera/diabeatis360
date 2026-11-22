// Unit tests for the doctor's Consultation History screen (DECISIONS D50). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { earningsCard, earningsHistory, groupByMonth, historyList, historyTabFor, HISTORY_TABS } from './consultation-history.ts';
import { manilaInstant } from '../booking/manila-time.ts';

const now = manilaInstant(2026, 10, 19, 9, 0); // Nov 19, 2026 in the Philippines
const at = (month, day, hour = 10) => manilaInstant(2026, month, day, hour, 0);
const ids = (list) => list.map((entry) => entry.id);

test('every booking status has exactly one tab; declined requests are under Cancelled', () => {
  assert.deepEqual(HISTORY_TABS, ['upcoming', 'completed', 'cancelled']);
  assert.equal(historyTabFor('pending'), 'upcoming');
  assert.equal(historyTabFor('confirmed'), 'upcoming');
  assert.equal(historyTabFor('completed'), 'completed');
  assert.equal(historyTabFor('declined'), 'cancelled');
  assert.equal(historyTabFor('cancelled'), 'cancelled');
  assert.equal(historyTabFor('something else'), null);
});

const bookings = [
  { id: 'a', status: 'completed', scheduledAt: at(10, 3), patientName: 'Maria Santos' },
  { id: 'b', status: 'completed', scheduledAt: at(9, 28), patientName: 'Jose Rizal' },
  { id: 'c', status: 'completed', scheduledAt: at(10, 15), patientName: 'Ana Reyes' },
  { id: 'd', status: 'confirmed', scheduledAt: at(10, 25), patientName: 'Maria Cruz' },
  { id: 'e', status: 'pending', scheduledAt: at(10, 21), patientName: 'Pedro Penduko' },
  { id: 'f', status: 'declined', scheduledAt: at(10, 18), patientName: 'Lea Salonga' },
  { id: 'g', status: 'completed', scheduledAt: null, patientName: 'No Time' },
];

test('order: Upcoming soonest first, the others newest first, a booking without a time last', () => {
  assert.deepEqual(ids(historyList(bookings, { tab: 'upcoming', thisMonthOnly: false, search: '' }, now)), ['e', 'd']);
  assert.deepEqual(ids(historyList(bookings, { tab: 'completed', thisMonthOnly: false, search: '' }, now)), ['c', 'a', 'b', 'g']);
  assert.deepEqual(ids(historyList(bookings, { tab: 'cancelled', thisMonthOnly: false, search: '' }, now)), ['f']);
});

test('"This Month" keeps the Philippine month; the search matches part of a name, any case', () => {
  assert.deepEqual(ids(historyList(bookings, { tab: 'completed', thisMonthOnly: true, search: '' }, now)), ['c', 'a']);
  assert.deepEqual(ids(historyList(bookings, { tab: 'completed', thisMonthOnly: false, search: '  maria ' }, now)), ['a']);
  assert.deepEqual(ids(historyList(bookings, { tab: 'upcoming', thisMonthOnly: false, search: 'MARIA' }, now)), ['d']);
});

test('month headings group consecutive bookings of the same month', () => {
  const list = historyList(bookings, { tab: 'completed', thisMonthOnly: false, search: '' }, now);
  assert.deepEqual(groupByMonth(list).map((group) => [group.year, group.month, ids(group.items)]), [
    [2026, 10, ['c', 'a']],
    [2026, 9, ['b']],
    [null, null, ['g']],
  ]);
});

// Wallet rows as wallet-activity.ts makes them: a consultation paid online keeps fee minus 15%; an on-site one only
// has the commission taken; a pending row is a paid, accepted consultation not finished yet.
const rows = [
  { id: 'a', kind: 'consultation', amount: 425, at: at(10, 3, 11), pending: false, detail: null },
  { id: 'c', kind: 'consultation', amount: 680, at: at(10, 15, 11), pending: false, detail: null },
  { id: 'b', kind: 'consultation', amount: 425, at: at(9, 28, 11), pending: false, detail: null },
  { id: 'h', kind: 'onsiteFee', amount: -75, at: at(10, 10, 11), pending: false, detail: null },
  { id: 'pending_d', kind: 'consultation', amount: 425, at: at(10, 25), pending: true, detail: null },
  { id: 'w1', kind: 'withdrawal', amount: -500, at: at(10, 16), pending: false, detail: 'GCash •••• 1234' },
];

test('the Earnings card: this month, consultations settled this month (on-site too), pending', () => {
  assert.deepEqual(earningsCard(rows, now), { thisMonth: 1105, consultations: 3, pending: 425 });
  assert.deepEqual(earningsCard([], now), { thisMonth: 0, consultations: 0, pending: 0 });
});

test('Earnings History: settled consultations paid online, newest first, with the patient from the booking', () => {
  assert.deepEqual(earningsHistory(rows, bookings), [
    { id: 'c', patientName: 'Ana Reyes', patientId: '', at: at(10, 15), amount: 680 },
    { id: 'a', patientName: 'Maria Santos', patientId: '', at: at(10, 3), amount: 425 },
    { id: 'b', patientName: 'Jose Rizal', patientId: '', at: at(9, 28), amount: 425 },
  ]);
});
