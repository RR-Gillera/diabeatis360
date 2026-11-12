// Unit tests for the allergy and ingredient search (src/constants/food-words.ts, DECISIONS.md D40). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALLERGY_CHOICES, foodKey, foodLabel, INGREDIENT_CHOICES, searchFoods } from './food-words.ts';

test('nothing is offered until something is typed', () => {
  assert.deepEqual(searchFoods('', ALLERGY_CHOICES), []);
  assert.deepEqual(searchFoods('   ', INGREDIENT_CHOICES), []);
});

test('typing finds a food by its English name, its Filipino name or another name', () => {
  assert.equal(searchFoods('shri', ALLERGY_CHOICES)[0], 'Shrimp');
  assert.ok(searchFoods('hipon', ALLERGY_CHOICES).includes('Shrimp'));
  assert.equal(searchFoods('lechon', INGREDIENT_CHOICES)[0], 'Pork');
  assert.equal(searchFoods('ampa', INGREDIENT_CHOICES)[0], 'Bitter gourd');
  assert.ok(searchFoods('kasoy', ALLERGY_CHOICES).includes('Tree nuts'));
});

test('names in the person\'s own language that start with the text come first, and the list is short', () => {
  const english = searchFoods('p', ALLERGY_CHOICES);
  assert.ok(english.length <= 8);
  assert.deepEqual(english.slice(0, 3), ['Peanuts', 'Pork', 'Pineapple']);
  assert.ok(english.indexOf('Seafood') > english.indexOf('Pineapple'), 'Pagkaing-dagat comes after the English names');
  assert.equal(searchFoods('p', ALLERGY_CHOICES, 'Filipino')[0], 'Seafood', 'in Filipino, Pagkaing-dagat comes first');
  assert.equal(searchFoods('a', INGREDIENT_CHOICES, 'English', 5).length, 5);
});

test('each list offers only its own choices', () => {
  assert.ok(!searchFoods('ampalaya', ALLERGY_CHOICES).length, 'bitter gourd is not offered as an allergy');
  assert.ok(searchFoods('sesame', ALLERGY_CHOICES).includes('Sesame'));
  assert.ok(!searchFoods('sesame', INGREDIENT_CHOICES).includes('Sesame'));
});

test('a stored food shows in the person\'s language; a typed one stays as typed', () => {
  assert.equal(foodLabel('Shrimp', 'Filipino'), 'Hipon');
  assert.equal(foodLabel('Shrimp', 'English'), 'Shrimp');
  assert.equal(foodLabel('nuts', 'English'), 'Nuts', 'an old lower-case answer is matched');
  assert.equal(foodLabel('Kiwi fruit', 'Filipino'), 'Kiwi fruit');
  assert.equal(foodKey('Hipon'), 'Shrimp');
  assert.equal(foodKey('dragon fruit'), '');
});

test('the four original allergy chips are still offered first', () => {
  assert.deepEqual(ALLERGY_CHOICES.slice(0, 4), ['Nuts', 'Dairy', 'Eggs', 'Seafood']);
});
