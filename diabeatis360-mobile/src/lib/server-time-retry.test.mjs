// Unit tests for saving a reading when the phone's clock is wrong (src/lib/server-time-retry.ts, QA DOC-012).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { saveWithServerTimeFallback } from './server-time-retry.ts';

const SERVER_TIME = { serverTime: true };
const reading = { reading_mgdl: 262, logged_at: 'phone time, 2 hours fast' };

test('a normal save is made once, with the phone\'s time', async () => {
  const saved = [];
  await saveWithServerTimeFallback(async (data) => { saved.push(data); return 'id-1'; }, reading, 'logged_at', SERVER_TIME);
  assert.deepEqual(saved, [reading]);
});

test('refused (a phone clock too far ahead): saved once more with the server\'s time, so the reading is not lost', async () => {
  const saved = [];
  const result = await saveWithServerTimeFallback(async (data) => {
    saved.push(data);
    if (saved.length === 1) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    return 'id-2';
  }, reading, 'logged_at', SERVER_TIME);
  assert.equal(result, 'id-2');
  assert.equal(saved.length, 2);
  assert.equal(saved[1].logged_at, SERVER_TIME);
  assert.equal(saved[1].reading_mgdl, 262, 'nothing else changes');
});

test('any other error is passed on without a second try', async () => {
  let calls = 0;
  await assert.rejects(
    saveWithServerTimeFallback(async () => { calls += 1; throw Object.assign(new Error('offline'), { code: 'unavailable' }); }, reading, 'logged_at', SERVER_TIME),
    /offline/,
  );
  assert.equal(calls, 1);
});

test('a second refusal is passed on (it is not about the clock)', async () => {
  await assert.rejects(
    saveWithServerTimeFallback(async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); }, reading, 'logged_at', SERVER_TIME),
    /denied/,
  );
});
