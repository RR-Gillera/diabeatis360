import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amountProblem, formatPeso, formatSignedPeso, parseAmount } from './wallet-format.ts';

test('pesos show a minus before the peso sign and a plus for money in', () => {
  assert.equal(formatPeso(425), '₱425.00');
  assert.equal(formatPeso(-75), '−₱75.00');
  assert.equal(formatPeso(1234.5), '₱1,234.50');
  assert.equal(formatSignedPeso(500), '+₱500.00');
  assert.equal(formatSignedPeso(-75), '−₱75.00');
  assert.equal(formatSignedPeso(0), '₱0.00');
});

test('typed amounts: commas are fine, anything else that is not a plain number is refused', () => {
  assert.equal(parseAmount(' 1,000.50 '), 1000.5);
  assert.equal(parseAmount('75'), 75);
  for (const text of ['', '-5', 'abc', '1e3', '5.', '₱5']) assert.ok(Number.isNaN(parseAmount(text)), text);
});

test('the same limits as the server: above ₱0, 2 decimals, at most the maximum, a withdrawal at most the balance', () => {
  assert.equal(amountProblem(100, 50000), null);
  assert.equal(amountProblem(0, 50000), 'invalid');
  assert.equal(amountProblem(Number.NaN, 50000), 'invalid');
  assert.equal(amountProblem(1.234, 50000), 'invalid');
  assert.equal(amountProblem(50001, 50000), 'tooHigh');
  assert.equal(amountProblem(425, 50000, 425), null);
  assert.equal(amountProblem(425.01, 50000, 425), 'overBalance');
  assert.equal(amountProblem(10, 50000, -75), 'overBalance');
});
