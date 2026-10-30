'use strict'
// The Philippine food list (scripts/data/ph-foods.js, DECISIONS.md D32): every row must pass the same checks as
// firestore.rules and the admin form, carry its serving in the name, and say where its numbers came from.
const assert = require('node:assert/strict')
const { test } = require('node:test')

const { foods } = require('../scripts/data/ph-foods')

const CATEGORIES = ['Grains', 'Protein', 'Vegetables', 'Fruits', 'Dairy', 'Beverages', 'Snacks', 'Condiments'] // admin services/foodDatabase.js

test('every food passes the rules: name, GI 0-100, calories >= 0, a known category', () => {
  for (const food of foods) {
    assert.ok(typeof food.food_name === 'string' && food.food_name.length > 0, food.id)
    assert.ok(Number.isInteger(food.glycemic_index) && food.glycemic_index >= 0 && food.glycemic_index <= 100, `${food.id} GI`)
    assert.ok(Number.isFinite(food.calories) && food.calories >= 0, `${food.id} calories`)
    assert.ok(CATEGORIES.includes(food.category), `${food.id} category ${food.category}`)
  }
})

test('every name carries its serving, and every row names its source', () => {
  for (const food of foods) {
    assert.match(food.food_name, /\(.+\)$/, `${food.id} has no serving in its name`)
    assert.match(food.source, /^GI: /, `${food.id} source`)
    assert.match(food.source, /kcal/, `${food.id} calorie source`)
  }
})

test('ids are unique and fixed (ph-...), so running the seed twice adds nothing twice', () => {
  const ids = foods.map((food) => food.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^ph-[a-z-]+$/)
})

test('the AI prompt reads at most 40 active foods, so the list fits', () => {
  assert.ok(foods.length <= 40, `${foods.length} foods`)
})

test('a few anchor values match the cited tables', () => {
  const gi = Object.fromEntries(foods.map((food) => [food.id, food.glycemic_index]))
  assert.equal(gi['ph-white-rice'], 71)
  assert.equal(gi['ph-malagkit'], 98)
  assert.equal(gi['ph-monggo'], 31)
  assert.equal(gi['ph-kamote'], 44)
})
