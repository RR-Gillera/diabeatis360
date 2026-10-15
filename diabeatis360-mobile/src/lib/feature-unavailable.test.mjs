// Unit tests for how the app recognises a missing Cloud Function or Storage bucket (docs/GO_LIVE.md, "Spark first").
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FEATURE_UNAVAILABLE_DETAIL, FEATURE_UNAVAILABLE_MESSAGE, FEATURE_UNAVAILABLE_TITLE, isFunctionMissing, isStorageMissing,
} from './feature-unavailable.ts';

test('the message people see is plain and has no technical words', () => {
  assert.equal(FEATURE_UNAVAILABLE_TITLE, "This feature isn't available yet");
  assert.equal(FEATURE_UNAVAILABLE_MESSAGE, `${FEATURE_UNAVAILABLE_TITLE}. ${FEATURE_UNAVAILABLE_DETAIL}`);
  assert.doesNotMatch(FEATURE_UNAVAILABLE_MESSAGE, /firebase|function|storage|blaze|404|error/i);
});

// ---- Cloud Functions

test('a function that is not deployed (the live Spark project today) is "missing"', () => {
  assert.equal(isFunctionMissing({ code: 'functions/not-found', message: 'not-found [404]' }), true);
  assert.equal(isFunctionMissing({ code: 'functions/not-found', message: 'not-found' }), true);
  assert.equal(isFunctionMissing({ code: 'functions/not-found' }), true);
});

test('a deployed function that is busy or down is NOT "missing": the person is told to try again', () => {
  assert.equal(isFunctionMissing({ code: 'functions/unavailable', message: 'The AI service is busy [503]' }), false);
  assert.equal(isFunctionMissing({ code: 'functions/internal', message: 'internal [500]' }), false);
  assert.equal(isFunctionMissing({ code: 'functions/deadline-exceeded', message: 'deadline-exceeded [504]' }), false);
});

test('a function that ran and answered with its own not-found wording is NOT "missing"', () => {
  assert.equal(isFunctionMissing({ code: 'functions/not-found', message: 'Your profile was not found [404]' }), false);
});

test('other function errors keep their own handling', () => {
  assert.equal(isFunctionMissing({ code: 'functions/resource-exhausted', message: 'Daily limit reached [429]' }), false);
  assert.equal(isFunctionMissing({ code: 'functions/unauthenticated', message: 'unauthenticated [401]' }), false);
  assert.equal(isFunctionMissing({ code: 'functions/permission-denied', message: 'permission-denied [403]' }), false);
});

test('function detection never throws on odd input', () => {
  for (const value of [null, undefined, 'functions/not-found', 404, {}, [], new Error('x')]) {
    assert.equal(isFunctionMissing(value), false);
  }
});

// ---- Cloud Storage

test('a Storage bucket that does not exist (HTTP 404) is "missing"', () => {
  assert.equal(isStorageMissing({ code: 'storage/unknown', status: 404 }), true);
});

test('an app built without a bucket name is "missing" too', () => {
  assert.equal(isStorageMissing({ code: 'storage/no-default-bucket' }), true);
  assert.equal(isStorageMissing({ code: 'storage/bucket-not-found' }), true);
});

test('a bucket that exists but refuses, or being offline, is NOT "missing"', () => {
  assert.equal(isStorageMissing({ code: 'storage/unauthorized', status: 403 }), false);
  assert.equal(isStorageMissing({ code: 'storage/unknown', status: 0 }), false);
  assert.equal(isStorageMissing({ code: 'storage/unknown', status: 500 }), false);
  assert.equal(isStorageMissing({ code: 'storage/retry-limit-exceeded', status: 0 }), false);
  assert.equal(isStorageMissing({ code: 'storage/canceled' }), false);
});

test('storage detection never throws on odd input', () => {
  for (const value of [null, undefined, 'storage/unknown', 404, {}, [], new Error('x')]) {
    assert.equal(isStorageMissing(value), false);
  }
});
