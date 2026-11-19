// Unit tests for the display labels (src/lib/labels.js). Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { allergyLabel } from './labels.js'

test('QA ADM-009: a patient who never answered shows "Not answered", never "None"', () => {
  for (const value of [undefined, null, '', '   ']) assert.equal(allergyLabel(value), 'Not answered')
})

test('an answer is shown as given, including "None" (the patient said they have no food allergies)', () => {
  assert.equal(allergyLabel('None'), 'None')
  assert.equal(allergyLabel('Peanuts, Shrimp'), 'Peanuts, Shrimp')
})
