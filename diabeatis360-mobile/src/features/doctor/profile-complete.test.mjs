// Unit tests for when a doctor can be found and booked (src/features/doctor/profile-complete.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isProfileComplete } from './profile-complete.ts';

const full = { specialty: 'Endocrinologist', prcLicenseNumber: '0123456', city: 'Cebu City', consultationFee: 500 };

test('a doctor with a specialty, PRC number, city and fee can be listed', () => {
  assert.equal(isProfileComplete(full), true);
});

test('a missing city, a ₱0 fee, a blank PRC number or specialty keeps the doctor off Find a Doctor', () => {
  assert.equal(isProfileComplete({ ...full, city: '' }), false);
  assert.equal(isProfileComplete({ ...full, city: '   ' }), false);
  assert.equal(isProfileComplete({ ...full, consultationFee: 0 }), false);
  assert.equal(isProfileComplete({ ...full, prcLicenseNumber: '' }), false);
  assert.equal(isProfileComplete({ ...full, specialty: '' }), false);
  assert.equal(isProfileComplete({ specialty: 'Endocrinologist' }), false, 'a doctor-made record before the profile is finished');
});
