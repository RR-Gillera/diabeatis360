// Unit tests for the blood sugar thresholds (manuscript UT-006 / DECISIONS.md D4). Run with: npm test
// Uses Node's built-in test runner, so there is no test dependency to install.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkReading, glucoseDirection, interpretGlucose, READING_LIMITS } from './glucose.ts';

test('critical low: below 54, both contexts', () => {
  for (const context of ['before_meal', 'after_meal']) {
    assert.equal(interpretGlucose(53, context), 'critical');
    assert.equal(interpretGlucose(20, context), 'critical');
  }
});

test('low: 54 to 69, both contexts', () => {
  for (const context of ['before_meal', 'after_meal']) {
    assert.equal(interpretGlucose(54, context), 'low');
    assert.equal(interpretGlucose(69, context), 'low');
  }
});

test('normal before a meal: 70 to 130', () => {
  assert.equal(interpretGlucose(70, 'before_meal'), 'normal');
  assert.equal(interpretGlucose(112, 'before_meal'), 'normal');
  assert.equal(interpretGlucose(130, 'before_meal'), 'normal');
});

test('normal after a meal: 70 to 179', () => {
  assert.equal(interpretGlucose(70, 'after_meal'), 'normal');
  assert.equal(interpretGlucose(150, 'after_meal'), 'normal');
  assert.equal(interpretGlucose(179, 'after_meal'), 'normal');
});

test('high before a meal: 131 to 249', () => {
  assert.equal(interpretGlucose(131, 'before_meal'), 'high');
  assert.equal(interpretGlucose(249, 'before_meal'), 'high');
});

test('high after a meal: 180 to 249', () => {
  assert.equal(interpretGlucose(180, 'after_meal'), 'high');
  assert.equal(interpretGlucose(249, 'after_meal'), 'high');
});

test('the same reading can differ by meal context (150 mg/dL)', () => {
  assert.equal(interpretGlucose(150, 'before_meal'), 'high');
  assert.equal(interpretGlucose(150, 'after_meal'), 'normal');
});

test('critical high: 250 and above, both contexts', () => {
  for (const context of ['before_meal', 'after_meal']) {
    assert.equal(interpretGlucose(250, context), 'critical');
    assert.equal(interpretGlucose(400, context), 'critical');
  }
});

test('direction tells critical low from critical high', () => {
  assert.equal(glucoseDirection(40, 'before_meal'), 'low');
  assert.equal(glucoseDirection(300, 'after_meal'), 'high');
  assert.equal(glucoseDirection(100, 'before_meal'), 'normal');
});

// DECISIONS.md D25: impossible values are refused, extreme ones need a confirmation.

test('reading limits: outside 20-600, decimals and non-numbers are refused', () => {
  for (const value of [0, -5, 19, 601, 9999, 1.5, 120.4, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(checkReading(value).ok, false, `${value} should be refused`);
  }
  assert.match(checkReading(9999).message, /from 20 to 600/);
});

test('reading limits: the ends of the range are allowed but need a confirmation', () => {
  for (const value of [READING_LIMITS.min, 39, 401, READING_LIMITS.max]) {
    assert.deepEqual(checkReading(value), { ok: true, needsConfirmation: true }, `${value}`);
  }
});

test('reading limits: everyday readings save without a question', () => {
  for (const value of [40, 54, 70, 130, 180, 250, 400]) {
    assert.deepEqual(checkReading(value), { ok: true, needsConfirmation: false }, `${value}`);
  }
});

test('prediabetes (D40): normal is 70-99 before a meal and 70-139 after; above that is high', () => {
  assert.equal(interpretGlucose(99, 'before_meal', 'Prediabetes'), 'normal');
  assert.equal(interpretGlucose(100, 'before_meal', 'Prediabetes'), 'high');
  assert.equal(interpretGlucose(115, 'before_meal', 'Prediabetes'), 'high');
  assert.equal(interpretGlucose(139, 'after_meal', 'Prediabetes'), 'normal');
  assert.equal(interpretGlucose(140, 'after_meal', 'Prediabetes'), 'high');
  assert.equal(glucoseDirection(115, 'before_meal', 'Prediabetes'), 'high');
});

test('prediabetes (D40): low and critical are the same as for everyone', () => {
  for (const context of ['before_meal', 'after_meal']) {
    assert.equal(interpretGlucose(53, context, 'Prediabetes'), 'critical');
    assert.equal(interpretGlucose(60, context, 'Prediabetes'), 'low');
    assert.equal(interpretGlucose(70, context, 'Prediabetes'), 'normal');
    assert.equal(interpretGlucose(250, context, 'Prediabetes'), 'critical');
  }
});

test('Type 1, Type 2 and a type not stated keep the D4 targets (D40)', () => {
  for (const type of ['Type 1', 'Type 2', '', undefined]) {
    assert.equal(interpretGlucose(130, 'before_meal', type), 'normal');
    assert.equal(interpretGlucose(131, 'before_meal', type), 'high');
    assert.equal(interpretGlucose(179, 'after_meal', type), 'normal');
    assert.equal(interpretGlucose(180, 'after_meal', type), 'high');
  }
});
