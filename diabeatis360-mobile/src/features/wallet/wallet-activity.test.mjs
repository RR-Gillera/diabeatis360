import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activityFromTransactions, filterActivity, pendingFromBookings, sortActivity, walletSummary } from './wallet-activity.ts';
import { lastFour, payoutLabel, payoutProblem } from './payout.ts';

const at = (iso) => new Date(iso);
const tx = (id, type, amount, bookingId, createdAt, method = null) => ({ id, type, amount, bookingId, createdAt, method, balanceAfter: 0 });

test('a consultation paid online is one row with what the doctor keeps; an on-site one is the commission only', () => {
  const rows = activityFromTransactions([
    tx('bk1_earning', 'earning', 500, 'bk1', at('2026-11-18T02:00:00Z'), 'GCash'),
    tx('bk1_commission', 'commission', -75, 'bk1', at('2026-11-18T02:00:00Z'), 'GCash'),
    tx('bk2_commission', 'commission', -75, 'bk2', at('2026-11-17T02:00:00Z'), 'Pay On-Site'),
    tx('w1', 'withdrawal', -200, null, at('2026-11-16T02:00:00Z'), 'BDO •••• 4821'),
  ]);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(rows.length, 3);
  assert.deepEqual([byId.bk1.kind, byId.bk1.amount], ['consultation', 425]);
  assert.deepEqual([byId.bk2.kind, byId.bk2.amount], ['onsiteFee', -75]);
  assert.deepEqual([byId.w1.kind, byId.w1.amount, byId.w1.detail], ['withdrawal', -200, 'BDO •••• 4821']);
});

test('only confirmed bookings paid online are pending, at the fee minus 15%', () => {
  const rows = pendingFromBookings([
    { id: 'a', status: 'confirmed', paymentStatus: 'paid', fee: 900, scheduledAt: at('2026-11-20T02:00:00Z') },
    { id: 'b', status: 'confirmed', paymentStatus: 'onsite', fee: 900, scheduledAt: null },
    { id: 'c', status: 'confirmed', paymentStatus: 'unpaid', fee: 900, scheduledAt: null },
    { id: 'd', status: 'completed', paymentStatus: 'paid', fee: 900, scheduledAt: null },
  ]);
  assert.deepEqual(rows.map((row) => [row.id, row.amount, row.pending]), [['pending_a', 765, true]]);
});

test('newest first with "just now" on top; the tabs filter by kind', () => {
  const rows = sortActivity([
    { id: 'old', kind: 'consultation', amount: 425, at: at('2026-11-01T00:00:00Z'), pending: false, detail: null },
    { id: 'now', kind: 'topup', amount: 75, at: null, pending: false, detail: 'GCash' },
    { id: 'mid', kind: 'withdrawal', amount: -100, at: at('2026-11-10T00:00:00Z'), pending: false, detail: null },
    { id: 'fee', kind: 'onsiteFee', amount: -75, at: at('2026-11-05T00:00:00Z'), pending: false, detail: null },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['now', 'mid', 'fee', 'old']);
  assert.deepEqual(filterActivity(rows, 'earnings').map((row) => row.id), ['fee', 'old']);
  assert.deepEqual(filterActivity(rows, 'withdrawals').map((row) => row.id), ['mid']);
  assert.equal(filterActivity(rows, 'all').length, 4);
});

test('earned this month counts paid-online consultations in this Philippine month only', () => {
  const now = at('2026-11-19T04:00:00Z');
  const rows = [
    { id: 'in', kind: 'consultation', amount: 425, at: at('2026-11-02T00:00:00Z'), pending: false, detail: null },
    // 31 Oct 17:00 UTC is already 1 Nov in Manila.
    { id: 'edge', kind: 'consultation', amount: 425, at: at('2026-10-31T17:00:00Z'), pending: false, detail: null },
    { id: 'lastMonth', kind: 'consultation', amount: 425, at: at('2026-10-31T15:00:00Z'), pending: false, detail: null },
    { id: 'onsite', kind: 'onsiteFee', amount: -75, at: at('2026-11-03T00:00:00Z'), pending: false, detail: null },
    { id: 'pend', kind: 'consultation', amount: 765, at: at('2026-11-20T00:00:00Z'), pending: true, detail: null },
  ];
  assert.deepEqual(walletSummary(rows, now), { pending: 765, earnedThisMonth: 850 });
});

test('a payout account needs a known bank, a name and a valid number; only the last 4 digits are kept', () => {
  assert.equal(payoutProblem('bank', 'BDO', 'Juan Dela Cruz', '0012 3456 4821'), null);
  assert.equal(payoutProblem('bank', 'Some Bank', 'Juan Dela Cruz', '001234564821'), 'provider');
  assert.equal(payoutProblem('bank', 'BDO', ' J ', '001234564821'), 'name');
  assert.equal(payoutProblem('bank', 'BDO', 'Juan Dela Cruz', '12345'), 'number');
  assert.equal(payoutProblem('gcash', 'GCash', 'Juan Dela Cruz', '0917-123-4567'), null);
  assert.equal(payoutProblem('gcash', 'GCash', 'Juan Dela Cruz', '08171234567'), 'number');
  assert.equal(payoutProblem('gcash', 'BDO', 'Juan Dela Cruz', '09171234567'), 'provider');
  assert.equal(lastFour('0012 3456 4821'), '4821');
  assert.equal(payoutLabel({ provider: 'BDO', last4: '4821' }), 'BDO •••• 4821');
});
