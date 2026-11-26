// Unit test: Android Back on a tab screen goes Home first, then needs a second press to exit (lib/tab-back.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXIT_WINDOW_MS, tabBackAction } from './tab-back.ts';

const NEVER = Number.POSITIVE_INFINITY;

test('a page opened on top of a tab keeps the normal Back', () => {
  assert.equal(tabBackAction({ canGoBack: true, onHome: false, msSinceLastPress: NEVER }), 'default');
  assert.equal(tabBackAction({ canGoBack: true, onHome: true, msSinceLastPress: 0 }), 'default');
});

test('Back on Log, Doctors or Profile goes to Home instead of closing the app', () => {
  assert.equal(tabBackAction({ canGoBack: false, onHome: false, msSinceLastPress: NEVER }), 'go-home');
  // Even right after a press on Home: you only exit from Home.
  assert.equal(tabBackAction({ canGoBack: false, onHome: false, msSinceLastPress: 100 }), 'go-home');
});

test('the first Back on Home only warns', () => {
  assert.equal(tabBackAction({ canGoBack: false, onHome: true, msSinceLastPress: NEVER }), 'warn');
});

test('a second Back on Home inside the window closes the app; after it, it warns again', () => {
  assert.equal(tabBackAction({ canGoBack: false, onHome: true, msSinceLastPress: 500 }), 'default');
  assert.equal(tabBackAction({ canGoBack: false, onHome: true, msSinceLastPress: EXIT_WINDOW_MS }), 'warn');
});
