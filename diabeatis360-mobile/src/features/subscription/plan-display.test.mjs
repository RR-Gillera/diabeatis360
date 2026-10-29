// Unit tests for how Premium plans are named and priced (Figma P-30 to P-32). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { peso, pesoShort, planLabel, savingsPercent } from './plan-display.ts';

test('plan names and units follow the frame', () => {
  assert.deepEqual(planLabel(30), { name: 'Monthly', unit: '/ month' });
  assert.deepEqual(planLabel(182), { name: '6 Months', unit: '/ 6 months' });
  assert.deepEqual(planLabel(365), { name: 'Yearly', unit: '/ year' });
});

test('savings match the frame for the manuscript prices (₱99, ₱499, ₱899)', () => {
  assert.equal(savingsPercent(99, 30, 99), null, 'monthly is the baseline');
  assert.equal(savingsPercent(499, 182, 99), 16);
  assert.equal(savingsPercent(899, 365, 99), 24);
  assert.equal(savingsPercent(1200, 365, 99), null, 'not cheaper: no badge');
  assert.equal(savingsPercent(499, 182, null), null);
});

test('pesos are written like the frame', () => {
  assert.equal(peso(899), '₱899.00');
  assert.equal(pesoShort(899), '₱899');
  assert.equal(pesoShort(99.5), '₱99.50');
});

test('plan names are said in Filipino too (D33)', () => {
  assert.deepEqual(planLabel(30, 'Filipino'), { name: 'Buwanan', unit: '/ buwan' });
  assert.deepEqual(planLabel(182, 'Filipino'), { name: '6 na Buwan', unit: '/ 6 na buwan' });
  assert.deepEqual(planLabel(365, 'Filipino'), { name: 'Taunan', unit: '/ taon' });
});
