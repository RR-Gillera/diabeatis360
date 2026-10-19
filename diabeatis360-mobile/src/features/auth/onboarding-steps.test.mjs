// Unit tests for resuming onboarding at the first unanswered question (DECISIONS.md D25). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstUnansweredStep } from './onboarding-steps.ts';

const patientSoFar = { language: 'English', profileType: 'patient', accountType: 'self', dateOfBirth: 'March 15, 1985', condition: 'Type 2' };

test('a fresh account starts at Language', () => {
  assert.equal(firstUnansweredStep({}), '/onboarding/language');
});

test('stopping at Allergies resumes at Allergies (the QA ACC-17 case)', () => {
  assert.equal(firstUnansweredStep(patientSoFar), '/onboarding/allergies');
  assert.equal(firstUnansweredStep({ ...patientSoFar, allergy: '' }), '/onboarding/allergies');
});

test('"None" answers the allergy question', () => {
  assert.equal(firstUnansweredStep({ ...patientSoFar, allergy: 'None' }), '/onboarding/activity');
});

test('every answer given: the last screen (Complete Setup)', () => {
  assert.equal(firstUnansweredStep({ ...patientSoFar, allergy: 'Nuts', activity: 'Light', diet: 'No Pork' }), '/onboarding/notifications');
});

test('doctors go to their professional details; a child account needs the guardian step', () => {
  assert.equal(firstUnansweredStep({ language: 'English', profileType: 'doctor' }), '/onboarding/professional-info');
  assert.equal(firstUnansweredStep({ language: 'English', profileType: 'patient', accountType: 'minor' }), '/onboarding/guardian');
  assert.equal(firstUnansweredStep({ language: 'English', profileType: 'patient', accountType: 'minor', guardianSubmitted: true }), '/onboarding/date-of-birth');
});
