// Unit tests for the consultation fee rule (src/constants/fees.ts, QA ADM-005). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { feeProblem, MAX_CONSULTATION_FEE, parseFee, roundFee } from './fees.ts';

test('a fee above ₱0 and up to the ceiling can be saved', () => {
  assert.equal(feeProblem(500), null);
  assert.equal(feeProblem(0.5), null);
  assert.equal(feeProblem(MAX_CONSULTATION_FEE), null);
});

test('a negative fee, ₱0, a fee above the ceiling and a non-number are refused', () => {
  assert.equal(feeProblem(-100), 'tooLow');
  assert.equal(feeProblem(-1), 'tooLow');
  assert.equal(feeProblem(0), 'tooLow');
  assert.equal(feeProblem(MAX_CONSULTATION_FEE + 0.01), 'tooHigh');
  assert.equal(feeProblem(Number.NaN), 'notNumber');
  assert.equal(feeProblem(Number.POSITIVE_INFINITY), 'notNumber');
});

test('typing: commas, spaces and the peso sign are ignored, a minus sign is kept, words are not numbers', () => {
  assert.equal(parseFee('1,500'), 1500);
  assert.equal(parseFee(' ₱ 750.50 '), 750.5);
  assert.equal(parseFee('-100'), -100, 'the old Set Fee screen dropped the minus and saved ₱100');
  assert.ok(Number.isNaN(parseFee('')));
  assert.ok(Number.isNaN(parseFee('abc')));
  assert.equal(feeProblem(parseFee('-100')), 'tooLow');
});

test('a fee is stored to the centavo', () => {
  assert.equal(roundFee(499.999), 500);
  assert.equal(roundFee(750.506), 750.51);
});
