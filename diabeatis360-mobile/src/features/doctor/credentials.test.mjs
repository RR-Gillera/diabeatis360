// Unit tests for the doctor's credentials suffix (src/features/doctor/credentials.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { credentialsChange, credentialsProblem, credentialsState, normalizeCredentials, withCredentials } from './credentials.ts';

const saved = (credentials = '', credentialsRequested = '', credentialsRejectionReason = '') => ({ credentials, credentialsRequested, credentialsRejectionReason });

test('what the doctor types is tidied into one spelling', () => {
  assert.equal(normalizeCredentials('MD,FPCP'), 'MD, FPCP');
  assert.equal(normalizeCredentials('  MD ,   FPCP ,MPH  '), 'MD, FPCP, MPH');
  assert.equal(normalizeCredentials(',MD,,FPCP,'), 'MD, FPCP');
  assert.equal(normalizeCredentials('M.D.,  Ph.D.'), 'M.D., Ph.D.');
  assert.equal(normalizeCredentials('   '), '');
});

test('letters, spaces and . , ( ) - only, up to 60 characters (the same as firestore.rules)', () => {
  assert.equal(credentialsProblem(''), null);
  assert.equal(credentialsProblem('MD, FPCP, FPSEDM'), null);
  assert.equal(credentialsProblem('M.D., Ph.D. (Hon)'), null);
  assert.equal(credentialsProblem('MD; FPCP'), 'doctor.cred.invalid');
  assert.equal(credentialsProblem('MD 2020'), 'doctor.cred.invalid');
  assert.equal(credentialsProblem('(MD)'), 'doctor.cred.invalid');
  assert.equal(credentialsProblem('M'.repeat(60)), null);
  assert.equal(credentialsProblem('M'.repeat(61)), 'doctor.cred.tooLong');
});

test('a waiting or refused request is shown before an older approved suffix', () => {
  assert.equal(credentialsState(saved()), 'none');
  assert.equal(credentialsState(saved('MD')), 'approved');
  assert.equal(credentialsState(saved('MD', 'MD, FPCP')), 'pending');
  assert.equal(credentialsState(saved('', 'MD, FPCP', 'Not in the PCP directory')), 'rejected');
});

test('the approved suffix goes after the name, and nothing is added without one', () => {
  assert.equal(withCredentials('Dr. Juan Dela Cruz', 'MD, FPCP'), 'Dr. Juan Dela Cruz, MD, FPCP');
  assert.equal(withCredentials('Dr. Juan Dela Cruz', ''), 'Dr. Juan Dela Cruz');
  assert.equal(withCredentials('Dr. Juan Dela Cruz', undefined), 'Dr. Juan Dela Cruz');
  assert.equal(withCredentials('', 'MD'), '');
});

test('saving Edit Profile: unchanged text does nothing', () => {
  assert.deepEqual(credentialsChange(saved(), ''), { action: 'none', value: '' });
  assert.deepEqual(credentialsChange(saved('MD'), 'MD'), { action: 'none', value: 'MD' });
  assert.deepEqual(credentialsChange(saved('', 'MD, FPCP'), 'MD,FPCP'), { action: 'none', value: 'MD, FPCP' });
});

test('saving Edit Profile: new text becomes a request, also after a refusal', () => {
  assert.deepEqual(credentialsChange(saved(), 'md, fpcp'), { action: 'request', value: 'md, fpcp' });
  assert.deepEqual(credentialsChange(saved('MD'), 'MD, FPCP'), { action: 'request', value: 'MD, FPCP' });
  assert.deepEqual(credentialsChange(saved('', 'MD, FPCP', 'Not found'), 'MD, FPCP'), { action: 'request', value: 'MD, FPCP' });
});

test('saving Edit Profile: going back to the approved text drops the request; an empty field removes everything', () => {
  assert.deepEqual(credentialsChange(saved('MD', 'MD, FPCP'), 'MD'), { action: 'withdraw', value: 'MD' });
  assert.deepEqual(credentialsChange(saved('', 'MD, FPCP'), ''), { action: 'withdraw', value: '' });
  assert.deepEqual(credentialsChange(saved('MD'), '  '), { action: 'remove', value: '' });
  assert.deepEqual(credentialsChange(saved('MD', 'MD, PhD'), ''), { action: 'remove', value: '' });
});
