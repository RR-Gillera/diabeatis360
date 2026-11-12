// Unit tests for the app PIN rules (src/features/pin/pin-rules.ts, DECISIONS.md D42). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isEasyPin, isValidPin, LOCK_AFTER_MS, MAX_PIN_ATTEMPTS, PIN_LENGTH, shouldLockAfter } from './pin-rules.ts';

test('a PIN is exactly 6 digits', () => {
  assert.equal(PIN_LENGTH, 6);
  assert.equal(isValidPin('482916'), true);
  assert.equal(isValidPin('48291'), false);
  assert.equal(isValidPin('4829160'), false);
  assert.equal(isValidPin('48291a'), false);
  assert.equal(isValidPin('      '), false);
  assert.equal(isValidPin(''), false);
});

test('repeated and straight-run PINs are too easy; ordinary ones are not', () => {
  for (const easy of ['000000', '111111', '999999', '123456', '234567', '654321', '987654']) {
    assert.equal(isEasyPin(easy), true, easy);
  }
  for (const fine of ['482916', '123123', '121212', '135791', '123457']) {
    assert.equal(isEasyPin(fine), false, fine);
  }
});

test('the app locks only after more than 30 seconds in the background', () => {
  assert.equal(LOCK_AFTER_MS, 30_000);
  assert.equal(shouldLockAfter(5_000), false);
  assert.equal(shouldLockAfter(30_000), false);
  assert.equal(shouldLockAfter(30_001), true);
});

test('five wrong tries are allowed before the person is signed out', () => {
  assert.equal(MAX_PIN_ATTEMPTS, 5);
});
