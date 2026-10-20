// Unit tests for the "Check your email" helpers (src/features/auth/verification.ts, DECISIONS.md D21).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CHECK_INTERVAL_MS, RESEND_COOLDOWN_SECONDS, RESET_RESEND_SECONDS, emailLanguageFor, errorCode, firstLocale, formatCountdown, maskEmail,
  verificationErrorMessage,
} from './verification.ts';

test('the reset screen shows which address got the email without spelling it out (Figma P-02)', () => {
  assert.equal(maskEmail('maria.santos@email.com'), 'm***@email.com');
  assert.equal(maskEmail('  A@b.co '), 'A***@b.co');
  assert.equal(maskEmail('not-an-address'), 'not-an-address');
  assert.equal(maskEmail('@nobody.com'), '@nobody.com');
  assert.equal(maskEmail(null), '');
  assert.equal(RESET_RESEND_SECONDS, 30);
});

test('the resend button waits a full minute and the screen checks every few seconds', () => {
  assert.equal(RESEND_COOLDOWN_SECONDS, 60);
  assert.ok(CHECK_INTERVAL_MS >= 3000 && CHECK_INTERVAL_MS <= 10000, 'often enough to feel instant, not so often it hammers Firebase');
});

test('the countdown reads like a clock and never goes negative', () => {
  assert.equal(formatCountdown(60), '1:00');
  assert.equal(formatCountdown(45), '0:45');
  assert.equal(formatCountdown(9), '0:09');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-3), '0:00');
  assert.equal(formatCountdown(44.2), '0:45', 'a part-second counts as a whole one');
});

test('a phone set to Filipino or Tagalog asks for the Filipino email; every other language gets English', () => {
  for (const locale of ['fil', 'fil-PH', 'FIL-ph', 'tl', 'tl-PH', 'fil_PH']) assert.equal(emailLanguageFor(locale), 'fil', locale);
  for (const locale of ['en', 'en-PH', 'en-US', 'ceb-PH', 'es', 'ja-JP', '', undefined, null]) assert.equal(emailLanguageFor(locale), 'en', String(locale));
});

test('the phone\'s own language setting wins over the others, and English is the fallback', () => {
  assert.equal(firstLocale('fil_PH', 'en-PH', 'en-US'), 'fil_PH', 'the phone\'s own setting is listed first and is used');
  assert.equal(firstLocale(undefined, 'fil-PH', 'en-US'), 'fil-PH', 'a missing first source is skipped');
  assert.equal(firstLocale(null, '', '   ', 'tl-PH'), 'tl-PH', 'empty and blank answers are skipped');
  assert.equal(firstLocale(), 'en');
  assert.equal(firstLocale(undefined, null, ''), 'en');
  // The pieces together, as auth-context.tsx uses them: a Filipino phone asks for the Filipino email even when the
  // JavaScript Intl default (listed last) says English.
  assert.equal(emailLanguageFor(firstLocale('fil_PH', 'en-PH')), 'fil');
  assert.equal(emailLanguageFor(firstLocale(undefined, 'fil-PH', 'en-PH')), 'fil');
  assert.equal(emailLanguageFor(firstLocale('en_US', 'fil-PH')), 'en');
});

test('failures are explained in plain words, with no error codes or technical terms', () => {
  assert.match(verificationErrorMessage('auth/too-many-requests'), /wait a few minutes/);
  assert.match(verificationErrorMessage('auth/network-request-failed'), /internet connection/);
  for (const code of ['auth/user-token-expired', 'auth/requires-recent-login', 'auth/user-not-found']) {
    assert.match(verificationErrorMessage(code), /log in again/, code);
  }
  assert.equal(verificationErrorMessage('auth/something-new'), 'We could not do that. Please try again.');
  assert.equal(verificationErrorMessage(undefined), 'We could not do that. Please try again.');
  for (const code of ['auth/too-many-requests', 'auth/network-request-failed', 'auth/user-token-expired', 'x']) {
    assert.doesNotMatch(verificationErrorMessage(code), /auth\/|firebase|token|error/i, code);
  }
});

test('errorCode reads the code of a thrown Firebase error and tolerates anything else', () => {
  assert.equal(errorCode({ code: 'auth/too-many-requests' }), 'auth/too-many-requests');
  assert.equal(errorCode(Object.assign(new Error('x'), { code: 'app/email-not-verified' })), 'app/email-not-verified');
  assert.equal(errorCode(new Error('no code')), undefined);
  assert.equal(errorCode('text'), undefined);
  assert.equal(errorCode(null), undefined);
  assert.equal(errorCode(undefined), undefined);
});
