// Unit tests for the phone-bar rules (src/constants/system-bars.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { navigationMode, tabBarBottomPadding } from './system-bars.ts';

test('Android 3-button navigation (48dp bar) is detected as buttons', () => {
  assert.equal(navigationMode(48, 'android'), 'buttons');
  assert.equal(navigationMode(32, 'android'), 'buttons');
});

test('Android swipe navigation (small handle) is detected as gesture', () => {
  assert.equal(navigationMode(16, 'android'), 'gesture');
  assert.equal(navigationMode(24, 'android'), 'gesture');
});

test('iPhones never report a button bar', () => {
  assert.equal(navigationMode(34, 'ios'), 'gesture');
  assert.equal(navigationMode(0, 'ios'), 'none');
});

test('no bottom bar at all is none', () => {
  assert.equal(navigationMode(0, 'android'), 'none');
});

test('tab bar clears the 3-button bar and keeps 24px with the swipe bar', () => {
  assert.equal(tabBarBottomPadding(48, 'android'), 56);
  assert.equal(tabBarBottomPadding(16, 'android'), 24);
  assert.equal(tabBarBottomPadding(0, 'android'), 24);
  assert.equal(tabBarBottomPadding(34, 'ios'), 34);
});
