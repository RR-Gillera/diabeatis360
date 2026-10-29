// Unit tests for a badge's words in the person's language (src/features/gamification/badge-text.ts, D33).
// Run with: npm test
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { badgeText, SHIPPED_BADGES } from './badge-text.ts';

const require = createRequire(import.meta.url);
const { badges } = require('../../../../functions/scripts/data/plans-and-badges.js');

test('every badge the app ships with has Filipino words, and the list matches the seed data', () => {
  assert.deepEqual([...SHIPPED_BADGES].sort(), badges.map((badge) => badge.id).sort());
  for (const badge of badges) {
    const stored = { id: badge.id, name: badge.badge_name, description: badge.badge_description, criteria: badge.criteria };
    const filipino = badgeText(stored, 'Filipino');
    assert.notEqual(filipino.name, stored.name, badge.id);
    assert.notEqual(filipino.goal, stored.criteria, badge.id);
  }
});

test('English always shows the stored words, so an admin\'s edit shows up', () => {
  const edited = { id: 'first_log', name: 'First Reading', description: 'Your first reading', criteria: '1 glucose log entry' };
  assert.deepEqual(badgeText(edited, 'English'), { name: 'First Reading', description: 'Your first reading', goal: '1 glucose log entry' });
});

test('a badge an admin adds later is shown as typed, in both languages', () => {
  const custom = { id: 'custom', name: 'Hydration Hero', description: 'Drank water', criteria: '5 day streak' };
  assert.deepEqual(badgeText(custom, 'Filipino'), { name: 'Hydration Hero', description: 'Drank water', goal: '5 day streak' });
});
