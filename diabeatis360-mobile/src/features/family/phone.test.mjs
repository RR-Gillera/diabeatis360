// Unit tests for the family contacts' phone numbers (DECISIONS.md D45). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contactProblem, contactsToSave, displayPhone, normalizePhilippineMobile } from './phone.ts';

test('the ways people type a Philippine mobile number all become +639XXXXXXXXX', () => {
  for (const typed of ['09171234567', '0917 123 4567', '0917-123-4567', '+639171234567', '+63 917 123 4567', '639171234567', '9171234567', '(0917) 123.4567']) {
    assert.equal(normalizePhilippineMobile(typed), '+639171234567', typed);
  }
});

test('landlines, foreign numbers, short or long numbers and letters are refused', () => {
  for (const typed of ['', '0281234567', '+15551234567', '0917123456', '091712345678', '0817 123 4567', 'abc', '+63 2 8123 4567']) {
    assert.equal(normalizePhilippineMobile(typed), null, typed);
  }
});

test('a saved number is shown the way people write it', () => {
  assert.equal(displayPhone('+639171234567'), '0917 123 4567');
  assert.equal(displayPhone('something else'), 'something else');
});

const row = (name, phone, relationship = '') => ({ name, relationship, phone });

test('an empty row is fine; a started row needs a name and a valid number; two rows need two different numbers', () => {
  assert.equal(contactProblem(row('', ''), null), null);
  assert.equal(contactProblem(row('  ', ' '), null), null);
  assert.equal(contactProblem(row('', '09171234567'), null), 'name');
  assert.equal(contactProblem(row('Maria', ''), null), 'phone');
  assert.equal(contactProblem(row('Maria', '0281234567'), null), 'phone');
  assert.equal(contactProblem(row('Maria', '', 'Mother'), null), 'phone');
  assert.equal(contactProblem(row('Jose', '0917 123 4567'), '+639171234567'), 'duplicate');
  assert.equal(contactProblem(row('Maria', '09171234567'), '+639181234567'), null);
});

test('only filled rows are saved, trimmed, with the number in the stored form', () => {
  assert.deepEqual(contactsToSave([row(' Maria ', '0917 123 4567', ' Mother '), row('', '')]), [
    { name: 'Maria', relationship: 'Mother', phone: '+639171234567' },
  ]);
  assert.deepEqual(contactsToSave([row('', ''), row('', '')]), []);
});
