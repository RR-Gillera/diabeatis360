import assert from 'node:assert/strict';
import { test } from 'node:test';

import { credentialStatus, doctorDisplayName, doctorInitials, licenseStatus } from './doctor-profile.ts';

test('a licence is valid through its expiry day and expired the day after', () => {
  const expiry = new Date(2026, 11, 15); // Dec 15, 2026
  assert.equal(licenseStatus(expiry, new Date(2026, 11, 15, 23, 59)), 'valid');
  assert.equal(licenseStatus(expiry, new Date(2026, 11, 16, 0, 1)), 'expired');
  assert.equal(licenseStatus(null), 'missing');
  assert.equal(licenseStatus(new Date('nope')), 'missing');
});

test('the credentials pill follows the admin decision', () => {
  assert.equal(credentialStatus(true, ''), 'verified');
  assert.equal(credentialStatus(true, 'old reason'), 'verified');
  assert.equal(credentialStatus(false, ''), 'pending');
  assert.equal(credentialStatus(false, '  '), 'pending');
  assert.equal(credentialStatus(false, 'Photo unreadable'), 'rejected');
});

test('the header adds "Dr." once and the avatar skips it', () => {
  assert.equal(doctorDisplayName('Juan Dela Cruz'), 'Dr. Juan Dela Cruz');
  assert.equal(doctorDisplayName('Dr. Juan Dela Cruz'), 'Dr. Juan Dela Cruz');
  assert.equal(doctorDisplayName('dr maria'), 'dr maria');
  assert.equal(doctorDisplayName('  '), '');
  assert.equal(doctorInitials('Dr. Juan Dela Cruz'), 'JC');
  assert.equal(doctorInitials('maria'), 'M');
  assert.equal(doctorInitials(''), 'D');
});
