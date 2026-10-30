// Unit test: the limits the app shows are the ones the server enforces (DECISIONS.md D5, D20). Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { FREE_LIMITS, PREMIUM_FAIR_USE } from './plans.ts';

const server = readFileSync(new URL('../../../functions/lib/limits.js', import.meta.url), 'utf8');

/** "const NAME = { ai: 2, scan: 3 }" in the server file, as numbers. */
function serverLimits(name) {
  const match = new RegExp(`const ${name} = \\{ ai: (\\d+), scan: (\\d+) \\}`).exec(server);
  assert.ok(match, `${name} not found in functions/lib/limits.js`);
  return { ai: Number(match[1]), scan: Number(match[2]) };
}

test('the Free limits match the server', () => {
  assert.deepEqual({ ...FREE_LIMITS }, serverLimits('FREE_LIMITS'));
});

test('the Premium fair-use ceiling matches the server', () => {
  assert.deepEqual({ ...PREMIUM_FAIR_USE }, serverLimits('PREMIUM_LIMITS'));
});
