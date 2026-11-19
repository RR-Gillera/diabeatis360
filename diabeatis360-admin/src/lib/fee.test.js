// Unit tests for the Add Provider fee rule (src/lib/fee.js, QA ADM-005). Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { feeProblem, MAX_CONSULTATION_FEE, parseFee, storedFee } from './fee.js'

test('a fee above ₱0 and up to ₱20,000 is accepted', () => {
  assert.equal(feeProblem('500'), '')
  assert.equal(feeProblem('1,500.50'), '')
  assert.equal(feeProblem(String(MAX_CONSULTATION_FEE)), '')
})

test('the QA cases: -100 and -1 are refused, and so are 0, an empty box and words', () => {
  for (const typed of ['-100', '-1', '0', '', '   ', 'abc']) assert.equal(feeProblem(typed), 'Enter a consultation fee above ₱0.', typed)
})

test('a fee above ₱20,000 is refused with the ceiling in the message', () => {
  assert.equal(feeProblem('20000.01'), 'That fee looks too high. The most the app accepts is ₱20,000.')
})

test('a minus sign is kept (never quietly dropped) and the stored fee is rounded to the centavo', () => {
  assert.equal(parseFee('-100'), -100)
  assert.equal(storedFee('750.506'), 750.51)
  assert.equal(storedFee('₱ 1,000'), 1000)
})
