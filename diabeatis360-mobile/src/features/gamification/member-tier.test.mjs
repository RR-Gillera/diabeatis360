// Unit tests for the Profile membership tier (src/features/gamification/member-tier.ts, DECISIONS.md D31).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compactNumber, memberTier } from './member-tier.ts';

test('tiers by points: Bronze under 500, Silver 500 to 1,499, Gold from 1,500', () => {
  assert.equal(memberTier(0).tier, 'Bronze');
  assert.equal(memberTier(499).tier, 'Bronze');
  assert.equal(memberTier(500).tier, 'Silver');
  assert.equal(memberTier(1499).tier, 'Silver');
  assert.equal(memberTier(1500).tier, 'Gold');
  assert.equal(memberTier(99999).tier, 'Gold');
});

test('how far to the next tier; Gold has none', () => {
  assert.deepEqual(memberTier(120), { tier: 'Bronze', next: 'Silver', pointsToNext: 380 });
  assert.deepEqual(memberTier(1200), { tier: 'Silver', next: 'Gold', pointsToNext: 300 });
  assert.deepEqual(memberTier(2000), { tier: 'Gold', next: null, pointsToNext: 0 });
});

test('bad input counts as zero points', () => {
  for (const value of [-5, Number.NaN, undefined, null]) assert.equal(memberTier(value).tier, 'Bronze');
});

test('stat tiles shorten big numbers like Figma ("1.2k")', () => {
  assert.equal(compactNumber(42), '42');
  assert.equal(compactNumber(999), '999');
  assert.equal(compactNumber(1000), '1k');
  assert.equal(compactNumber(1234), '1.2k');
  assert.equal(compactNumber(1999), '1.9k', 'rounds down, never shows more than earned');
  assert.equal(compactNumber(15200), '15k');
  assert.equal(compactNumber(Number.NaN), '0');
});
