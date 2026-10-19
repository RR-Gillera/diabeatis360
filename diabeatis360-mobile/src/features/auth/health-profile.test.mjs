// Unit tests for the Profile screen's health-profile helpers (DECISIONS.md D25). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allergiesDeclared, birthdateText, changedHealthFields, healthFormProblem, profileToForm } from './health-profile.ts';

const stored = {
  birthdate: { toDate: () => new Date(1985, 2, 15) },
  diabetes_type: 'Type 2',
  allergies: 'Peanuts, Shellfish',
  activity_level: 'Light',
  dietary_preference: 'No Pork',
};

test('the form is filled from the stored profile (so a new phone is not blank)', () => {
  assert.deepEqual(profileToForm(stored), { dateOfBirth: 'March 15, 1985', condition: 'Type 2', allergy: 'Peanuts, Shellfish', activity: 'Light', diet: 'No Pork' });
});

test('the old Pre-Diabetic label is shown as Prediabetes', () => {
  assert.equal(profileToForm({ diabetes_type: 'Pre-Diabetic' }).condition, 'Prediabetes');
});

test('only changed fields are saved', () => {
  const before = profileToForm(stored);
  assert.deepEqual(changedHealthFields(before, { ...before, condition: 'Type 1', allergy: 'Eggs' }), { condition: 'Type 1', allergy: 'Eggs' });
  assert.deepEqual(changedHealthFields(before, before), {});
});

test('a blank field never overwrites what is stored (the QA data-loss bug)', () => {
  const before = profileToForm(stored);
  const blankForm = { dateOfBirth: '', condition: 'Type 1', allergy: '', activity: '', diet: '' };
  assert.deepEqual(changedHealthFields(before, blankForm), { condition: 'Type 1' });
});

test('allergies must be answered; None counts as an answer', () => {
  assert.match(healthFormProblem({ ...profileToForm(stored), allergy: '  ' }), /type None/);
  assert.equal(healthFormProblem({ ...profileToForm(stored), allergy: 'None' }), null);
  assert.equal(allergiesDeclared('None'), true);
  assert.equal(allergiesDeclared(''), false);
  assert.equal(allergiesDeclared(undefined), false);
  assert.equal(allergiesDeclared(['Eggs']), true);
});

test('birthdate text: Date, Timestamp-like and stored text', () => {
  assert.equal(birthdateText(new Date(2001, 0, 9)), 'January 9, 2001');
  assert.equal(birthdateText('February 4, 2018'), 'February 4, 2018');
  assert.equal(birthdateText(null), '');
});
