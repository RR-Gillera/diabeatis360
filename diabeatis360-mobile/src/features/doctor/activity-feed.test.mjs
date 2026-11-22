// Unit tests for the doctor's Recent Activity timeline (src/features/doctor/activity-feed.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activityTarget, buildDoctorActivity, groupByDay, matchesFilter, noticeGroup } from './activity-feed.ts';

// Philippine time is UTC+8, so 02:00 UTC on Nov 22 is 10:00 AM Manila time on Nov 22.
const at = (iso) => new Date(iso);

const booking = (id, extra = {}) => ({
  id, patientId: `p-${id}`, patientName: `Patient ${id}`, scheduledAt: at('2026-11-25T02:00:00Z'), status: 'pending',
  createdAt: at('2026-11-22T02:00:00Z'), endedAt: null, endedBy: null, ...extra,
});
const notice = (id, type, sentAt, extra = {}) => ({ id, type, message: `${type} ${id}`, isRead: false, sentAt: at(sentAt), severity: 'info', relatedId: '', ...extra });

test('every booking becomes a request row at the time it was sent', () => {
  const rows = buildDoctorActivity([booking('a')], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'request');
  assert.equal(rows[0].when.toISOString(), '2026-11-22T02:00:00.000Z');
});

test('a consultation the doctor ended adds a finished row; one the patient ended does not (its notification covers it)', () => {
  const byDoctor = booking('d', { status: 'completed', endedAt: at('2026-11-25T03:00:00Z'), endedBy: 'doctor' });
  const byPatient = booking('p', { status: 'completed', endedAt: at('2026-11-25T03:00:00Z'), endedBy: 'patient' });
  const rows = buildDoctorActivity([byDoctor, byPatient], []);
  assert.deepEqual(rows.filter((row) => row.source === 'finished').map((row) => row.booking.id), ['d']);
});

test('rows are newest first, and rows without a time go last', () => {
  const rows = buildDoctorActivity(
    [booking('old', { createdAt: at('2026-11-20T02:00:00Z') }), booking('none', { createdAt: null })],
    [notice('n1', 'message', '2026-11-21T02:00:00Z')],
  );
  assert.deepEqual(rows.map((row) => row.id), ['notice-n1', 'request-old', 'request-none']);
});

test('filters: appointments, patients (messages and readings), and account rows under All only', () => {
  assert.equal(noticeGroup('booking_update'), 'appointments');
  assert.equal(noticeGroup('message'), 'patients');
  assert.equal(noticeGroup('glucose_alert'), 'patients');
  assert.equal(noticeGroup('doctor_verification'), 'account');
  assert.equal(noticeGroup('report_update'), 'account');
  const [verification] = buildDoctorActivity([], [notice('v', 'doctor_verification', '2026-11-22T02:00:00Z')]);
  assert.equal(matchesFilter(verification, 'all'), true);
  assert.equal(matchesFilter(verification, 'appointments'), false);
  assert.equal(matchesFilter(verification, 'patients'), false);
});

test('days are Philippine days: 11:30 PM Manila stays on its own day', () => {
  const rows = buildDoctorActivity([], [
    notice('late', 'message', '2026-11-22T15:30:00Z'), // Nov 22, 11:30 PM in Manila
    notice('early', 'message', '2026-11-22T00:30:00Z'), // Nov 22, 8:30 AM in Manila
    notice('before', 'message', '2026-11-21T15:00:00Z'), // Nov 21, 11:00 PM in Manila
  ]);
  const days = groupByDay(rows);
  assert.deepEqual(days.map((day) => day.day), ['2026-11-22', '2026-11-21']);
  assert.deepEqual(days[0].rows.map((row) => row.id), ['notice-late', 'notice-early']);
});

test('tapping a row opens the same places as the Inbox', () => {
  const patients = new Map([['b1', 'patient-1']]);
  const [request] = buildDoctorActivity([booking('b1')], []);
  assert.deepEqual(activityTarget(request, patients), { screen: 'request', id: 'b1' });
  const [finished] = buildDoctorActivity([booking('b1', { createdAt: null, endedAt: at('2026-11-25T03:00:00Z'), endedBy: 'doctor' })], [])
    .filter((row) => row.source === 'finished');
  assert.deepEqual(activityTarget(finished, patients), { screen: 'summary', id: 'b1' });
  const [critical] = buildDoctorActivity([], [notice('c', 'glucose_alert', '2026-11-22T02:00:00Z', { relatedId: 'b1', severity: 'critical' })]);
  assert.deepEqual(activityTarget(critical, patients), { screen: 'patient', id: 'patient-1' });
  const [unknownPatient] = buildDoctorActivity([], [notice('c2', 'glucose_alert', '2026-11-22T02:00:00Z', { relatedId: 'b9' })]);
  assert.deepEqual(activityTarget(unknownPatient, patients), { screen: 'chat', id: 'b9' });
  const [message] = buildDoctorActivity([], [notice('m', 'message', '2026-11-22T02:00:00Z', { relatedId: 'b1' })]);
  assert.deepEqual(activityTarget(message, patients), { screen: 'chat', id: 'b1' });
  const [review] = buildDoctorActivity([], [notice('v', 'doctor_verification', '2026-11-22T02:00:00Z')]);
  assert.deepEqual(activityTarget(review, patients), { screen: 'profile' });
  const [reply] = buildDoctorActivity([], [notice('r', 'report_update', '2026-11-22T02:00:00Z')]);
  assert.deepEqual(activityTarget(reply, patients), { screen: 'reports' });
  const [loose] = buildDoctorActivity([], [notice('x', 'announcement', '2026-11-22T02:00:00Z')]);
  assert.equal(activityTarget(loose, patients), null);
});
