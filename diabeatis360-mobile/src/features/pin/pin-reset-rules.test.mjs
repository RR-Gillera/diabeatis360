// Unit tests for "Forgot PIN?" (src/features/pin/pin-reset-rules.ts, DECISIONS.md D56). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canConfirm, confirmMethods, confirmPasswordErrorKey, isOtherAccount } from './pin-reset-rules.ts';

test('each account is offered only the sign-ins it has', () => {
  assert.deepEqual(confirmMethods(['password']), { password: true, social: [] });
  assert.deepEqual(confirmMethods(['facebook.com']), { password: false, social: ['facebook'] });
  assert.deepEqual(confirmMethods(['google.com']), { password: false, social: ['google'] });
  assert.deepEqual(confirmMethods(['password', 'google.com', 'facebook.com']), { password: true, social: ['google', 'facebook'] });
});

test('an account with no known sign-in cannot confirm (the screen falls back to logging in again)', () => {
  assert.equal(canConfirm(confirmMethods([])), false);
  assert.equal(canConfirm(confirmMethods(['phone'])), false);
  assert.equal(canConfirm(confirmMethods(['facebook.com'])), true);
});

test('password errors get plain messages', () => {
  assert.equal(confirmPasswordErrorKey({ code: 'auth/invalid-credential' }), 'pin.reset.wrongPassword');
  assert.equal(confirmPasswordErrorKey({ code: 'auth/wrong-password' }), 'pin.reset.wrongPassword');
  assert.equal(confirmPasswordErrorKey({ code: 'auth/too-many-requests' }), 'auth.error.tooMany');
  assert.equal(confirmPasswordErrorKey({ code: 'auth/network-request-failed' }), 'verify.error.offline');
  assert.equal(confirmPasswordErrorKey(new Error('boom')), 'pin.reset.failed');
  assert.equal(confirmPasswordErrorKey(null), 'pin.reset.failed');
});

test('a different Google/Facebook account is recognised', () => {
  assert.equal(isOtherAccount({ code: 'auth/user-mismatch' }), true);
  assert.equal(isOtherAccount({ code: 'auth/invalid-credential' }), false);
  assert.equal(isOtherAccount(undefined), false);
});
