// Unit tests for the server-target precedence rule (src/lib/server-target.ts, QA defect PAT-002).
// The point: in emulator mode the live server address must NEVER be used.
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isEmulatorMode, resolveServerBaseUrl } from './server-target.ts';

const LIVE = 'https://diabeatis360-ai.vercel.app';

test('emulator mode ignores the live address', () => {
  assert.equal(resolveServerBaseUrl(true, LIVE), '');
  assert.equal(resolveServerBaseUrl(true, undefined), '');
});

test('outside emulator mode the configured address is used, without a trailing slash', () => {
  assert.equal(resolveServerBaseUrl(false, `${LIVE}/`), LIVE);
});

test('outside emulator mode with no address the Firebase functions are used', () => {
  assert.equal(resolveServerBaseUrl(false, undefined), '');
  assert.equal(resolveServerBaseUrl(false, ''), '');
});

test('emulator mode needs a dev build AND the flag set to "true"', () => {
  assert.equal(isEmulatorMode(true, 'true'), true);
  assert.equal(isEmulatorMode(false, 'true'), false, 'a release build ignores the flag');
  assert.equal(isEmulatorMode(true, undefined), false);
  assert.equal(isEmulatorMode(true, '1'), false);
});
