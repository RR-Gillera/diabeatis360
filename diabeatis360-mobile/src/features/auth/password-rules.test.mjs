// Unit tests for the Change Password checks (src/features/auth/password-rules.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changePasswordErrorKey, newPasswordProblem } from './password-rules.ts';

test('all three fields are required', () => {
  assert.equal(newPasswordProblem('', 'newpass123', 'newpass123'), 'auth.error.required');
  assert.equal(newPasswordProblem('oldpass123', '', ''), 'auth.error.required');
  assert.equal(newPasswordProblem('oldpass123', 'newpass123', ''), 'auth.error.required');
});

test('the new password needs at least 8 characters, like sign-up', () => {
  assert.equal(newPasswordProblem('oldpass123', 'short7c', 'short7c'), 'auth.error.passwordShort');
  assert.equal(newPasswordProblem('oldpass123', '8chars!!', '8chars!!'), null);
});

test('the two new passwords must match', () => {
  assert.equal(newPasswordProblem('oldpass123', 'newpass123', 'newpass124'), 'auth.error.passwordsDiffer');
});

test('the new password must differ from the current one', () => {
  assert.equal(newPasswordProblem('samepass123', 'samepass123', 'samepass123'), 'password.change.same');
});

test('a wrong current password gets its own message', () => {
  assert.equal(changePasswordErrorKey({ code: 'auth/invalid-credential' }), 'password.change.wrongCurrent');
  assert.equal(changePasswordErrorKey({ code: 'auth/wrong-password' }), 'password.change.wrongCurrent');
});

test('other Firebase errors map to known messages, anything else to a general one', () => {
  assert.equal(changePasswordErrorKey({ code: 'auth/too-many-requests' }), 'auth.error.tooMany');
  assert.equal(changePasswordErrorKey({ code: 'auth/weak-password' }), 'auth.error.weakPassword');
  assert.equal(changePasswordErrorKey({ code: 'auth/network-request-failed' }), 'password.change.failed');
  assert.equal(changePasswordErrorKey(new Error('boom')), 'password.change.failed');
  assert.equal(changePasswordErrorKey(null), 'password.change.failed');
});
