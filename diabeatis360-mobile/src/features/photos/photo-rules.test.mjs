// Unit tests for the profile photo checks (src/features/photos/photo-rules.ts, D54). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { centerSquare, isSavablePhoto, PHOTO_MAX_LENGTH, photoDataUri } from './photo-rules.ts';

test('a JPEG data address of normal size can be saved', () => {
  assert.equal(isSavablePhoto(photoDataUri('/9j/4AAQSkZJRgABAQ==')), true);
});

test('empty, too long, non-JPEG or broken photos are refused before Firestore sees them', () => {
  assert.equal(isSavablePhoto(photoDataUri('')), false);
  assert.equal(isSavablePhoto(photoDataUri('A'.repeat(PHOTO_MAX_LENGTH))), false);
  assert.equal(isSavablePhoto('data:image/png;base64,iVBORw0KGgo='), false);
  assert.equal(isSavablePhoto('https://example.com/me.jpg'), false);
  assert.equal(isSavablePhoto(photoDataUri('abc def')), false);
});

test('the centered square of a picture', () => {
  assert.deepEqual(centerSquare(400, 300), { originX: 50, originY: 0, width: 300, height: 300 });
  assert.deepEqual(centerSquare(300, 401), { originX: 0, originY: 50, width: 300, height: 300 });
  assert.deepEqual(centerSquare(256, 256), { originX: 0, originY: 0, width: 256, height: 256 });
});
