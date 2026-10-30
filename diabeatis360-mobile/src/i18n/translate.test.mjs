// Unit tests for the translations (src/i18n, DECISIONS.md D33). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { en } from './en.ts';
import { fil } from './fil.ts';
import { displayDate, monthNames, toLanguage, translate } from './translate.ts';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('every English text has a Filipino text, and nothing extra', () => {
  assert.deepEqual(Object.keys(fil).sort(), Object.keys(en).sort());
  for (const [key, text] of Object.entries(fil)) assert.ok(text.trim().length > 0, `${key} is empty`);
});

test('the Filipino text uses the same {placeholders} as the English one', () => {
  for (const key of Object.keys(en)) assert.deepEqual(placeholders(fil[key]), placeholders(en[key]), key);
});

test('line breaks in titles are kept, so titles wrap where the design wraps them', () => {
  for (const key of Object.keys(en)) {
    if (en[key].includes('\n')) assert.ok(fil[key].includes('\n'), `${key} lost its line break`);
  }
});

test('translate picks the language and fills placeholders; unknown language means English', () => {
  assert.equal(translate('Filipino', 'common.next'), 'Susunod');
  assert.equal(translate('English', 'common.next'), 'Next');
  assert.equal(translate('English', 'common.percentComplete', { percent: 40 }), '40% Complete');
  assert.equal(translate('Filipino', 'common.percentComplete', { percent: 40 }), '40% Kumpleto');
  assert.equal(translate('English', 'common.percentComplete'), '{percent}% Complete', 'a missing value is left visible, not blank');
  assert.equal(toLanguage('Filipino'), 'Filipino');
  for (const value of ['English', '', undefined, 'Tagalog', null]) assert.equal(toLanguage(value), 'English');
});

test('dates: stored English text shown with Filipino months', () => {
  assert.equal(displayDate('March 14, 1981', 'Filipino'), 'Marso 14, 1981');
  assert.equal(displayDate('December 1, 2000', 'Filipino'), 'Disyembre 1, 2000');
  assert.equal(displayDate('March 14, 1981', 'English'), 'March 14, 1981');
  assert.equal(displayDate('Select your date of birth', 'Filipino'), 'Select your date of birth', 'non-dates unchanged');
  assert.equal(monthNames('Filipino').length, 12);
  assert.equal(monthNames('Filipino')[5], 'Hunyo');
});
