// Unit tests for how the risk screen shows the server's result (DECISIONS.md D51). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arcPoint, factorText, factorTone, gaugeFraction, riskIntroKey } from './risk-display.ts';

test('the gauge follows the score, never quite empty, never past full', () => {
  assert.equal(gaugeFraction(0, 7), 0.06);
  assert.equal(gaugeFraction(7, 7), 1);
  assert.ok(Math.abs(gaugeFraction(3, 7) - 3 / 7) < 1e-9);
  assert.equal(gaugeFraction(9, 7), 1);
  assert.equal(gaugeFraction(NaN, 7), 0.06);
});

test('the arc starts on the left, tops out in the middle and ends on the right', () => {
  assert.deepEqual(arcPoint(0, 100, 100, 80), { x: 20, y: 100 });
  assert.deepEqual(arcPoint(0.5, 100, 100, 80), { x: 100, y: 20 });
  assert.deepEqual(arcPoint(1, 100, 100, 80), { x: 180, y: 100 });
});

test('prediabetes is worded as the risk of type 2; Type 1 and 2 as blood sugar control', () => {
  assert.equal(riskIntroKey('Prediabetes'), 'risk.intro.pre');
  assert.equal(riskIntroKey('Type 1'), 'risk.intro.diabetes');
  assert.equal(riskIntroKey('Type 2'), 'risk.intro.diabetes');
});

test('the pill colour comes from the points the factor added', () => {
  assert.equal(factorTone({ key: 'dangerous', status: 'critical', points: 2, value: {} }), 'bad');
  assert.equal(factorTone({ key: 'trend', status: 'rising', points: 1, value: {} }), 'watch');
  assert.equal(factorTone({ key: 'trend', status: 'improving', points: 0, value: {} }), 'good');
  assert.equal(factorTone({ key: 'trend', status: 'unknown', points: 0, value: { percent: null } }), 'neutral');
});

test('each factor reads with its numbers, in English and Filipino', () => {
  const average = { key: 'average', status: 'above', points: 1, value: { mgdl: 142, limit: 130, context: 'before_meal' } };
  assert.deepEqual(factorText(average, 'English'), { title: 'Average reading', status: 'Above range', detail: '142 mg/dL before meals (target up to 130)' });
  const trend = { key: 'trend', status: 'rising', points: 1, value: { percent: 12 } };
  assert.equal(factorText(trend, 'English').detail, '+12% compared with the 3 weeks before');
  assert.equal(factorText({ key: 'trend', status: 'unknown', points: 0, value: { percent: null } }, 'English').status, 'Not enough data');
  const filipino = factorText({ key: 'in_range', status: 'good', points: 0, value: { percent: 80 } }, 'Filipino');
  assert.ok(filipino.detail.includes('80%'));
  assert.notEqual(filipino.title, 'Readings in range');
});
