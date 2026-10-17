// Unit tests for the Google/Facebook sign-in helpers (src/features/auth/social-types.ts, DECISIONS.md D23).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SocialLoginError, isCancelled, providerName, socialErrorMessage } from './social-types.ts';

test('the two providers have the names people know them by', () => {
  assert.equal(providerName('google'), 'Google');
  assert.equal(providerName('facebook'), 'Facebook');
});

test('only closing the Google/Facebook window counts as "cancelled", and it shows no message', () => {
  assert.equal(isCancelled(new SocialLoginError('cancelled')), true);
  assert.equal(isCancelled(new SocialLoginError('failed')), false);
  assert.equal(isCancelled(new Error('cancelled')), false, 'a plain error is not the person closing the window');
  assert.equal(isCancelled(undefined), false);
  assert.equal(socialErrorMessage(new SocialLoginError('cancelled'), 'google'), '');
});

test('every other way a sign-in can stop has its own plain message that names the provider where it helps', () => {
  const failures = ['unavailable', 'not-configured', 'play-services', 'no-email', 'failed'];
  const messages = failures.map((failure) => socialErrorMessage(new SocialLoginError(failure), 'facebook'));
  for (const message of messages) assert.ok(message.length > 20, 'a real sentence');
  assert.equal(new Set(messages).size, failures.length, 'each reason reads differently');
  assert.match(socialErrorMessage(new SocialLoginError('unavailable'), 'google'), /Google/);
  assert.match(socialErrorMessage(new SocialLoginError('unavailable'), 'google'), /installed Diabeatis360 app/);
  assert.match(socialErrorMessage(new SocialLoginError('no-email'), 'facebook'), /Facebook did not share an email/);
  assert.match(socialErrorMessage(new SocialLoginError('play-services'), 'google'), /Play services/);
});

test('the Firebase errors people can actually hit are explained', () => {
  const sameEmail = socialErrorMessage({ code: 'auth/account-exists-with-different-credential' }, 'facebook');
  assert.match(sameEmail, /already has a Diabeatis360 account/);
  assert.match(sameEmail, /email and password/);
  assert.match(socialErrorMessage({ code: 'auth/network-request-failed' }, 'google'), /No internet connection/);
  assert.match(socialErrorMessage({ code: 'auth/user-disabled' }, 'google'), /deactivated/);
  assert.match(socialErrorMessage({ code: 'app/account-deactivated' }, 'google'), /deactivated/);
  assert.match(socialErrorMessage({ code: 'auth/operation-not-allowed' }, 'facebook'), /Facebook sign-in is not switched on/);
  assert.match(socialErrorMessage({ code: 'auth/too-many-requests' }, 'google'), /Too many attempts/);
});

test('anything unexpected gets a generic message and never repeats the raw error text', () => {
  const generic = 'We could not sign you in with Google. Please try again.';
  assert.equal(socialErrorMessage(new Error('token eyJhbGciOi.secret.value was rejected'), 'google'), generic);
  assert.equal(socialErrorMessage({ code: 'auth/something-new' }, 'google'), generic);
  assert.equal(socialErrorMessage(undefined, 'google'), generic);
  assert.equal(socialErrorMessage('boom', 'facebook'), 'We could not sign you in with Facebook. Please try again.');
});
