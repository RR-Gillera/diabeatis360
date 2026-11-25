// Unit tests for "Report a problem" (DECISIONS.md D51). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { conductCategoryFor, conductReportId, REPORT_MESSAGE_MAX, reportFields, reportProblem } from './report-form.ts';

test('a report needs a category the system knows', () => {
  assert.equal(reportProblem(null, 'The chart does not load.'), 'category');
  assert.equal(reportProblem('spam', 'The chart does not load.'), 'category');
  assert.equal(reportProblem('app_problem', 'The chart does not load.'), null);
});

test('the message needs 10 to 1,000 characters, not counting spaces at the ends', () => {
  assert.equal(reportProblem('other', 'broken'), 'tooShort');
  assert.equal(reportProblem('other', '   broken   '), 'tooShort');
  assert.equal(reportProblem('other', 'it is broken'), null);
  assert.equal(reportProblem('other', 'x'.repeat(REPORT_MESSAGE_MAX)), null);
  assert.equal(reportProblem('other', 'x'.repeat(REPORT_MESSAGE_MAX + 1)), 'tooLong');
});

test('a patient flags a doctor, and a doctor flags a patient', () => {
  assert.equal(conductCategoryFor('patient'), 'doctor_conduct');
  assert.equal(conductCategoryFor('doctor'), 'patient_conduct');
});

test('a general report names nobody, even if a person was passed in', () => {
  const fields = reportFields({ reporterId: 'p1', reporterRole: 'patient', category: 'payment', message: '  I was charged twice.  ', reportedUserId: 'd1', bookingId: 'b1' });
  assert.deepEqual(fields, { reporter_id: 'p1', reporter_role: 'patient', category: 'payment', message: 'I was charged twice.', status: 'open' });
});

test('a conduct report carries the person and the booking', () => {
  const fields = reportFields({ reporterId: 'p1', reporterRole: 'patient', category: 'doctor_conduct', message: 'The doctor never joined.', reportedUserId: 'd1', bookingId: 'b1' });
  assert.equal(fields.reported_user_id, 'd1');
  assert.equal(fields.booking_id, 'b1');
  assert.equal(fields.status, 'open');
});

test('a conduct report is filed under "<bookingId>_<reporterId>" (D58), the id firestore.rules expects', () => {
  assert.equal(conductReportId('bk123', 'p1'), 'bk123_p1');
});
