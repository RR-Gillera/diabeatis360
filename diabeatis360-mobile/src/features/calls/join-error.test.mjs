// Unit tests for what people see when the video room cannot be opened (src/features/calls/join-error.ts, D27).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { joinErrorMessage, VIDEO_NOT_SET_UP, VIDEO_OFFLINE } from './join-error.ts';

const failed = (code, message) => Object.assign(new Error(message), { code });

test('the server\'s own wording is shown, without the HTTP status', () => {
  assert.equal(joinErrorMessage(failed('functions/failed-precondition', 'This call is not active any more. [400]')), 'This call is not active any more.');
  assert.equal(joinErrorMessage(failed('functions/unavailable', 'Video calls are not set up yet. Please use the chat for now.')), VIDEO_NOT_SET_UP);
  assert.equal(joinErrorMessage(failed('functions/permission-denied', 'You are not part of this call.')), 'You are not part of this call.');
});

test('an endpoint that is not deployed says "not set up yet", not "try again"', () => {
  assert.equal(joinErrorMessage(failed('functions/not-found', 'not-found [404]')), VIDEO_NOT_SET_UP);
});

test('no internet, a bare status or an unknown error is a plain "check your connection" message', () => {
  assert.equal(joinErrorMessage(failed('functions/internal', 'internal')), VIDEO_OFFLINE);
  assert.equal(joinErrorMessage(failed('functions/unavailable', 'unavailable [503]')), VIDEO_OFFLINE);
  assert.equal(joinErrorMessage(new Error('Failed to fetch')), VIDEO_OFFLINE);
  assert.equal(joinErrorMessage('boom'), VIDEO_OFFLINE);
});

test('a signed-out person is asked to sign in again', () => {
  assert.equal(joinErrorMessage(failed('functions/unauthenticated', 'Please sign in.')), 'Please sign in again to join the call.');
});
