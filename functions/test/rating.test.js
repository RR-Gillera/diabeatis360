'use strict'
const assert = require('node:assert/strict')
const { test } = require('node:test')

const { rateNutrients } = require('../lib/rating')

test('rating: low sugar, carbs and sodium is suitable', () => {
  assert.equal(rateNutrients({ sugar_g: 2, carbs_g: 10, sodium_mg: 100 }).rating, 'suitable')
})

test('rating: the worst nutrient decides, and is named in the insight', () => {
  const caution = rateNutrients({ sugar_g: 9, carbs_g: 10, sodium_mg: 100 })
  assert.equal(caution.rating, 'caution')
  assert.match(caution.insight, /9 g of sugar/)
  const unsuitable = rateNutrients({ sugar_g: 9, carbs_g: 50, sodium_mg: 100 })
  assert.equal(unsuitable.rating, 'unsuitable')
  assert.match(unsuitable.insight, /50 g of carbohydrates/)
})

test('rating: missing values count as zero', () => {
  assert.equal(rateNutrients({}).rating, 'suitable')
  assert.equal(rateNutrients(undefined).rating, 'suitable')
})
