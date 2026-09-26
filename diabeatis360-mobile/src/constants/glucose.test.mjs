// Unit tests for the blood sugar thresholds (manuscript UT-006 / DECISIONS.md D4). Run with: npm test
// Uses Node's built-in test runner, so there is no test dependency to install.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { glucoseDirection, interpretGlucose } from './glucose.ts';

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
