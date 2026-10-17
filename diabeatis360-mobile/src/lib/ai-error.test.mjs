// Unit tests for how the app understands a failed AI call (src/lib/ai-error.ts, DECISIONS.md D20).
// The point: only the Free daily limit may offer "Upgrade to Premium". A Premium person's fair-use ceiling and the
// whole project's daily cap must not, because upgrading cannot lift them.
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AiError, toAiError } from './ai-error.ts';

// What the Firebase Functions client throws: a code, a message and the server's details.
const exhausted = (details, message = 'x') => Object.assign(new Error(message), { code: 'functions/resource-exhausted', details });

test('the Free daily limit is "limit", the one case where the screens offer Premium', () => {
  const error = toAiError(exhausted({ limit: 2, feature: 'ai', scope: 'free' }, 'You have used all 2 free AI suggestions for today. Upgrade to Premium for unlimited use, or try again tomorrow. [429]'));
  assert.ok(error instanceof AiError);
  assert.equal(error.code, 'limit');
  assert.equal(error.message, 'You have used all 2 free AI suggestions for today. Upgrade to Premium for unlimited use, or try again tomorrow.', 'the [429] status is not shown to people');
});

test('a reply with no scope (an older server) always meant the Free limit', () => {
  assert.equal(toAiError(exhausted({ limit: 3, feature: 'scan' })).code, 'limit');
  assert.equal(toAiError(exhausted(undefined)).code, 'limit');
  assert.equal(toAiError(exhausted(null)).code, 'limit');
  assert.equal(toAiError(exhausted('text')).code, 'limit');
});

test('a Premium fair-use ceiling and the project-wide cap are "daily-cap": no upgrade offer', () => {
  const fairUse = toAiError(exhausted({ limit: 30, feature: 'ai', scope: 'fair_use' }, "You have reached today's fair-use limit of 30 AI suggestions. Please try again tomorrow."));
  assert.equal(fairUse.code, 'daily-cap');
  assert.equal(fairUse.message, "You have reached today's fair-use limit of 30 AI suggestions. Please try again tomorrow.");
  const project = toAiError(exhausted({ feature: 'scan', scope: 'project' }, 'The AI helper has reached its daily limit for all users. Please try again tomorrow.'));
  assert.equal(project.code, 'daily-cap');
  assert.doesNotMatch(project.message, /upgrade/i);
});

test('an unknown scope is treated as the Free limit rather than silently hiding the upgrade offer', () => {
  assert.equal(toAiError(exhausted({ scope: 'something-new' })).code, 'limit');
});

test('the server refusing an unconfirmed email is "unverified", with the server\'s own wording (D21)', () => {
  const error = toAiError(Object.assign(new Error('Please verify your email address first. Open the link we sent to your inbox, then try again. [403]'), { code: 'functions/permission-denied' }));
  assert.equal(error.code, 'unverified');
  assert.equal(error.message, 'Please verify your email address first. Open the link we sent to your inbox, then try again.');
  assert.equal(toAiError({ code: 'functions/permission-denied' }).message, 'Please verify your email address first.');
});

test('the other server errors keep their meaning', () => {
  assert.equal(toAiError({ code: 'functions/unauthenticated' }).code, 'signed-out');
  assert.equal(toAiError(Object.assign(new Error('Send a JPEG, PNG or WebP photo of the label.'), { code: 'functions/invalid-argument' })).code, 'invalid');
  for (const code of ['functions/unavailable', 'functions/not-found', 'functions/internal', 'functions/deadline-exceeded']) {
    assert.equal(toAiError({ code }).code, 'unavailable', code);
  }
  assert.equal(toAiError({ code: 'functions/something-else' }).code, 'unknown');
  assert.equal(toAiError('not even an error').code, 'unknown');
  assert.equal(toAiError(undefined).code, 'unknown');
});
