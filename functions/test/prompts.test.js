'use strict'
// Pure-logic tests for the AI prompts and the cleaning of model output. Run: npm test (inside functions/)
const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  buildLabelPrompt, buildRecommendationPrompt, cleanExercises, cleanLabel, cleanMeals, containsAllergen, parseAllergens, SYSTEM_RULES,
} = require('../lib/prompts')

test('parseAllergens splits, lowercases and ignores "none"', () => {
  assert.deepEqual(parseAllergens('Peanuts, Shellfish; dairy'), ['peanuts', 'shellfish', 'dairy'])
  assert.deepEqual(parseAllergens('None'), [])
  assert.deepEqual(parseAllergens(''), [])
  assert.deepEqual(parseAllergens(undefined), [])
  assert.deepEqual(parseAllergens(['Egg', ' Soy ']), ['egg', 'soy'])
})

test('containsAllergen finds allergens case-insensitively', () => {
  assert.deepEqual(containsAllergen('Chicken Adobo with PEANUT sauce', ['peanut', 'egg']), ['peanut'])
  assert.deepEqual(containsAllergen('Grilled fish', ['peanut']), [])
})

test('the meal prompt carries diabetes type, allergies and the safety rules', () => {
  const { system, user } = buildRecommendationPrompt({
    kind: 'meal',
    profile: { diabetes_type: 'Type 2', allergies: 'Peanuts, Shellfish', dietary_preference: 'No Pork', activity_level: 'Light', language_preference: 'Filipino' },
    reading: { reading_mgdl: 190, context: 'after_meal', interpretation: 'high' },
    foods: [{ food_name: 'Brown Rice', glycemic_index: 68, category: 'Grains', calories: 110 }],
  })
  assert.match(user, /Type 2/)
  assert.match(user, /peanuts, shellfish/)
  assert.match(user, /No Pork/)
  assert.match(user, /190 mg\/dL after a meal/)
  assert.match(user, /Filipino \(Tagalog\)/)
  assert.match(user, /Brown Rice \(GI 68/)
  assert.match(system, /NEVER diagnose/)
  assert.match(system, /insulin or drug doses/)
  assert.match(system, /MUST avoid every allergen/)
  assert.equal(system, SYSTEM_RULES)
})

test('the exercise prompt forbids strenuous exercise when low', () => {
  const { user } = buildRecommendationPrompt({ kind: 'exercise', profile: {}, reading: null, foods: [] })
  assert.match(user, /Never suggest strenuous exercise if the latest reading is low/)
  assert.match(user, /none recorded yet/)
})

test('cleanMeals drops any meal that mentions a declared allergen', () => {
  const meals = cleanMeals([
    { name: 'Chicken Tinola', tagline: 'Light soup', calories: 250, protein_g: 28, carbs_g: 12, fiber_g: 3, sugar_g: 4, insight: 'ok', ingredients: ['chicken', 'papaya', 'ginger'] },
    { name: 'Kare-kare', tagline: 'Stew', calories: 500, protein_g: 30, carbs_g: 30, fiber_g: 4, sugar_g: 5, insight: 'ok', ingredients: ['oxtail', 'peanut sauce'] },
    { name: 'Sinigang na Hipon', tagline: 'Sour soup', calories: 200, protein_g: 20, carbs_g: 10, fiber_g: 2, sugar_g: 3, insight: 'ok', ingredients: ['shrimp', 'tamarind'] },
  ], ['peanut', 'shrimp'])
  assert.deepEqual(meals.map((meal) => meal.name), ['Chicken Tinola'])
})

test('cleanMeals clamps numbers and ignores malformed entries', () => {
  const meals = cleanMeals([{ name: 'Test', calories: -5, protein_g: 'abc', carbs_g: 99999, fiber_g: 2, sugar_g: 1, ingredients: 'not-a-list' }, null, { tagline: 'no name' }], [])
  assert.equal(meals.length, 1)
  assert.equal(meals[0].calories, 0)
  assert.equal(meals[0].protein_g, 0)
  assert.equal(meals[0].carbs_g, 500)
  assert.deepEqual(meals[0].ingredients, [])
})

test('cleanExercises keeps light or moderate and bounds the duration', () => {
  const list = cleanExercises([
    { name: 'Walk', description: 'x', duration_minutes: 500, intensity: 'HIGH', caution: 'c' },
    { name: 'Yoga', description: 'x', duration_minutes: 1, intensity: 'Moderate', caution: 'c' },
    { description: 'no name' },
  ])
  assert.equal(list.length, 2)
  assert.equal(list[0].duration_minutes, 120)
  assert.equal(list[0].intensity, 'light')
  assert.equal(list[1].duration_minutes, 5)
  assert.equal(list[1].intensity, 'moderate')
})

test('cleanExercises keeps a tagline and at most 3 benefits', () => {
  const [item] = cleanExercises([{ name: 'Walk', tagline: 'Low-impact', description: 'x', duration_minutes: 20, intensity: 'light', benefits: ['a', 'b', 'c', 'd'], caution: 'c' }])
  assert.equal(item.tagline, 'Low-impact')
  assert.deepEqual(item.benefits, ['a', 'b', 'c'])
})

test('cleanLabel: unreadable input stays unreadable', () => {
  assert.deepEqual(cleanLabel({ readable: false }, []), { readable: false })
  assert.deepEqual(cleanLabel(null, []), { readable: false })
})

test('cleanLabel: an allergen in the ingredients forces "unsuitable" and a warning', () => {
  const result = cleanLabel({
    readable: true, product_name: 'Choco Bar', ingredients_text: 'sugar, cocoa, PEANUTS, milk', calories: 250, carbs_g: 30, sugar_g: 20,
    fiber_g: 2, protein_g: 5, sodium_mg: 100, health_rating: 'suitable', insight: 'looks fine',
    alternatives: [{ instead_of: 'Choco Bar', try: 'Peanut brittle' }, { instead_of: 'Choco Bar', try: 'Fresh mango' }],
  }, ['peanuts'])
  assert.equal(result.health_rating, 'unsuitable')
  assert.deepEqual(result.allergen_warnings, ['Contains peanuts'])
  // an alternative that itself contains the allergen is removed
  assert.deepEqual(result.alternatives.map((entry) => entry.try), ['Fresh mango'])
})

test('cleanLabel: an invalid rating falls back to caution', () => {
  const result = cleanLabel({ readable: true, product_name: 'X', health_rating: 'great' }, [])
  assert.equal(result.health_rating, 'caution')
  assert.equal(result.product_name, 'X')
})

test('the label prompt asks for a personalised judgement and Filipino swaps', () => {
  const { user } = buildLabelPrompt({ profile: { diabetes_type: 'Type 1', allergies: 'Milk' } })
  assert.match(user, /Type 1/)
  assert.match(user, /milk/)
  assert.match(user, /alternatives/)
  assert.match(user, /"readable" to false/)
})

test('containsAllergen matches singular and plural on whole words only', () => {
  assert.deepEqual(containsAllergen('peanut brittle', ['peanuts']), ['peanuts'])
  assert.deepEqual(containsAllergen('Peanuts and rice', ['peanut']), ['peanut'])
  assert.deepEqual(containsAllergen('egg drop soup', ['eggs']), ['eggs'])
  assert.deepEqual(containsAllergen('buko pie with coconut milk', ['nuts']), [])
  assert.deepEqual(containsAllergen('mixed nuts', ['nuts']), ['nuts'])
  assert.deepEqual(containsAllergen('Shellfish soup', ['shellfish']), ['shellfish'])
  assert.deepEqual(containsAllergen('tree nuts, sugar', ['tree nuts']), ['tree nuts'])
})
