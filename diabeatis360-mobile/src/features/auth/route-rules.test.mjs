// Unit tests for which screens each role may open (src/features/auth/route-rules.ts, QA D-15). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PATIENT_ONLY, redirectFor } from './route-rules.ts';

test('a patient who opens a doctor address goes to their Home; someone signed out goes to the start', () => {
  assert.equal(redirectFor('doctor', 'user'), '/user-home');
  assert.equal(redirectFor('doctor', 'guest'), '/');
  assert.equal(redirectFor('doctor', 'doctor'), null);
});

test('a doctor who opens a patient-only screen goes to the dashboard', () => {
  for (const screen of PATIENT_ONLY) assert.equal(redirectFor(screen, 'doctor'), '/doctor', screen);
  for (const screen of PATIENT_ONLY) assert.equal(redirectFor(screen, 'user'), null, screen);
  assert.equal(redirectFor('user-home', 'guest'), '/');
});

test('shared screens are open to everyone', () => {
  for (const screen of ['consultation', 'video-call', 'language-settings', 'privacy-policy', 'terms-of-service', 'onboarding', 'login', 'sign-up', 'verify-email', 'forgot-password', 'landing', undefined]) {
    for (const role of ['guest', 'user', 'doctor']) assert.equal(redirectFor(screen, role), null, `${screen} for ${role}`);
  }
});
