'use strict'
// Integration tests for the AI handlers against the FIRESTORE EMULATOR with a fake Gemini.
// Run:  firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/handlers.test.js"
// Without the emulator running these tests are skipped (so `npm test` never touches a real database).
const assert = require('node:assert/strict')
const { test } = require('node:test')

const emulator = process.env.FIRESTORE_EMULATOR_HOST
const skip = emulator ? false : 'set FIRESTORE_EMULATOR_HOST (run inside firebase emulators:exec)'

const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { analyzeLabel, generateRecommendations, CRITICAL_MESSAGE } = require('../lib/handlers')

let db
const mealsAnswer = {
  items: [
    { name: 'Chicken Tinola', tagline: 'Light soup', calories: 250, protein_g: 28, carbs_g: 12, fiber_g: 3, sugar_g: 4, insight: 'Low sugar', ingredients: ['chicken', 'papaya', 'ginger'] },
    { name: 'Kare-kare', tagline: 'Peanut stew', calories: 520, protein_g: 30, carbs_g: 30, fiber_g: 4, sugar_g: 5, insight: 'rich', ingredients: ['oxtail', 'peanut sauce'] },
    { name: 'Grilled Bangus', tagline: 'Fish', calories: 300, protein_g: 32, carbs_g: 8, fiber_g: 1, sugar_g: 1, insight: 'Lean protein', ingredients: ['bangus', 'tomato'] },
  ],
}
const exercisesAnswer = { items: [{ name: 'Brisk walk', description: 'Easy pace', duration_minutes: 20, intensity: 'light', caution: 'Stop if dizzy' }] }
const labelAnswer = {
  readable: true, product_name: 'Berry Energy Bar', brand: 'Acme', serving_size: '45 g', ingredients_text: 'oats, sugar, peanuts, berries',
  calories: 250, carbs_g: 45, sugar_g: 22, fiber_g: 2, protein_g: 5, sodium_mg: 150, health_rating: 'caution', insight: 'High in sugar',
  alternatives: [{ instead_of: 'Energy bar', try: 'Fresh guava' }],
}
const png = { mimeType: 'image/png', base64: 'aGVsbG8=' }

// A fake Gemini that records how often it was called.
function fakeAi(answer) {
  const ai = async () => { ai.calls += 1; return typeof answer === 'function' ? answer() : answer }
  ai.calls = 0
  return ai
}
const code = async (promise) => { try { await promise; return 'ok' } catch (error) { return error.code } }

test.before(() => {
  if (skip) return
  initializeApp({ projectId: 'demo-diabeatis360' })
  db = getFirestore()
})

async function reset() {
  for (const name of ['Users', 'Glucose_Logs', 'Subscriptions', 'AI_Suggestions', 'AI_Suggestions_Foods', 'Nutrition_Scans', 'Food_Database']) {
    const snapshot = await db.collection(name).get()
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()))
  }
}
const addUser = (uid, extra = {}) => db.doc(`Users/${uid}`).set({ full_name: uid, diabetes_type: 'Type 2', allergies: 'peanuts', language_preference: 'English', ...extra })
const addReading = (uid, value, context = 'before_meal') => db.collection('Glucose_Logs').add({ patient_id: uid, reading_mgdl: value, context, logged_at: Timestamp.now() })

test('meal suggestions: allergen removed, saved, foods linked, quota counted', { skip }, async () => {
  await reset()
  await addUser('u1')
  await addReading('u1', 110)
  const food = await db.collection('Food_Database').add({ food_name: 'Bangus', glycemic_index: 40, category: 'Fish', calories: 150, status: 'active' })
  await db.collection('Food_Database').add({ food_name: 'Hidden', status: 'hidden' })
  const ai = fakeAi(mealsAnswer)

  const result = await generateRecommendations({ db, uid: 'u1', kind: 'meal', callAi: ai })
  assert.equal(result.blocked, false)
  assert.deepEqual(result.items.map((meal) => meal.name), ['Chicken Tinola', 'Grilled Bangus'], 'the peanut dish must be removed')
  assert.equal(result.remaining, 1)
  assert.equal(ai.calls, 1)

  const saved = await db.collection('AI_Suggestions').get()
  assert.equal(saved.size, 1)
  assert.equal(saved.docs[0].data().user_id, 'u1')
  assert.equal(saved.docs[0].data().suggestion_type, 'meal')
  assert.match(saved.docs[0].data().prompt, /Type 2/)
  assert.match(saved.docs[0].data().prompt, /peanuts/)
  assert.match(saved.docs[0].data().prompt, /Bangus/)
  assert.doesNotMatch(saved.docs[0].data().prompt, /Hidden/, 'hidden foods are not offered to the model')
  const links = await db.collection('AI_Suggestions_Foods').get()
  assert.equal(links.size, 1)
  assert.equal(links.docs[0].data().food_id, food.id)
  assert.equal(links.docs[0].data().suggestion_id, saved.docs[0].id)
})

test('free plan: the third AI generation of the day is refused', { skip }, async () => {
  await reset()
  await addUser('u2', { allergies: 'None' })
  const ai = fakeAi(exercisesAnswer)
  const first = await generateRecommendations({ db, uid: 'u2', kind: 'exercise', callAi: ai })
  const second = await generateRecommendations({ db, uid: 'u2', kind: 'meal', callAi: fakeAi(mealsAnswer) })
  assert.equal(first.remaining, 1)
  assert.equal(second.remaining, 0)
  assert.equal(await code(generateRecommendations({ db, uid: 'u2', kind: 'exercise', callAi: ai })), 'resource-exhausted')
  assert.equal(ai.calls, 1, 'no Gemini call once the limit is reached')
  assert.equal((await db.collection('AI_Suggestions').get()).size, 2)
})

test('premium: no daily limit', { skip }, async () => {
  await reset()
  await addUser('u3', { allergies: 'None' })
  await db.collection('Subscriptions').add({ user_id: 'u3', status: 'active', expires_at: Timestamp.fromMillis(Date.now() + 10 * 86400000) })
  for (let i = 0; i < 4; i += 1) {
    const result = await generateRecommendations({ db, uid: 'u3', kind: 'exercise', callAi: fakeAi(exercisesAnswer) })
    assert.equal(result.remaining, null)
  }
  assert.equal((await db.collection('AI_Suggestions').get()).size, 4)
})

test('an expired premium subscription no longer lifts the limit', { skip }, async () => {
  await reset()
  await addUser('u4', { allergies: 'None' })
  await db.collection('Subscriptions').add({ user_id: 'u4', status: 'active', expires_at: Timestamp.fromMillis(Date.now() - 86400000) })
  await generateRecommendations({ db, uid: 'u4', kind: 'exercise', callAi: fakeAi(exercisesAnswer) })
  await generateRecommendations({ db, uid: 'u4', kind: 'exercise', callAi: fakeAi(exercisesAnswer) })
  assert.equal(await code(generateRecommendations({ db, uid: 'u4', kind: 'exercise', callAi: fakeAi(exercisesAnswer) })), 'resource-exhausted')
})

test('a critical reading blocks suggestions: no Gemini call, nothing saved or counted', { skip }, async () => {
  await reset()
  await addUser('u5')
  await addReading('u5', 320)
  const ai = fakeAi(mealsAnswer)
  const result = await generateRecommendations({ db, uid: 'u5', kind: 'meal', callAi: ai })
  assert.equal(result.blocked, true)
  assert.equal(result.reason, 'critical')
  assert.equal(result.message, CRITICAL_MESSAGE)
  assert.match(result.message, /doctor|hospital/)
  assert.deepEqual(result.items, [])
  assert.equal(ai.calls, 0)
  assert.equal((await db.collection('AI_Suggestions').get()).size, 0)
})

test('the block follows the most recent reading, not an older one', { skip }, async () => {
  await reset()
  await addUser('u6', { allergies: 'None' })
  await db.collection('Glucose_Logs').add({ patient_id: 'u6', reading_mgdl: 320, context: 'before_meal', logged_at: Timestamp.fromMillis(Date.now() - 3 * 86400000) })
  await addReading('u6', 105)
  const result = await generateRecommendations({ db, uid: 'u6', kind: 'exercise', callAi: fakeAi(exercisesAnswer) })
  assert.equal(result.blocked, false)
})

test('bad input and Gemini failures are handled without saving or counting', { skip }, async () => {
  await reset()
  await addUser('u7')
  assert.equal(await code(generateRecommendations({ db, uid: 'u7', kind: 'dessert', callAi: fakeAi(mealsAnswer) })), 'invalid-argument')
  const failing = async () => { throw new Error('boom') }
  assert.equal(await code(generateRecommendations({ db, uid: 'u7', kind: 'meal', callAi: failing })), 'unavailable')
  assert.equal(await code(generateRecommendations({ db, uid: 'u7', kind: 'meal', callAi: fakeAi({ items: [{ name: 'Peanut soup', ingredients: ['peanuts'] }] }) })), 'unavailable', 'nothing safe left after allergen filtering')
  assert.equal((await db.collection('AI_Suggestions').get()).size, 0)
})

test('label scan: analysed, saved without the image, rating forced by allergen', { skip }, async () => {
  await reset()
  await addUser('u8')
  const ai = fakeAi(labelAnswer)
  const result = await analyzeLabel({ db, uid: 'u8', image: png, callAi: ai })
  assert.equal(result.readable, true)
  assert.equal(result.product_name, 'Berry Energy Bar')
  assert.equal(result.health_rating, 'unsuitable', 'peanuts are in the ingredients and the user is allergic')
  assert.deepEqual(result.allergen_warnings, ['Contains peanuts'])
  assert.equal(result.remaining, 2)
  const scans = await db.collection('Nutrition_Scans').get()
  assert.equal(scans.size, 1)
  const stored = scans.docs[0].data()
  assert.equal(stored.user_id, 'u8')
  assert.equal(stored.image_url, null, 'D2: the image is never stored')
  assert.equal(stored.health_rating, 'unsuitable')
  assert.equal(stored.analysis.sugar_g, 22)
  assert.ok(!JSON.stringify(stored).includes(png.base64), 'the photo itself must not be saved')
  assert.equal(ai.calls, 1)
})

test('label scan: an unreadable photo is not saved and does not use up the daily allowance', { skip }, async () => {
  await reset()
  await addUser('u9')
  const result = await analyzeLabel({ db, uid: 'u9', image: png, callAi: fakeAi({ readable: false }) })
  assert.equal(result.readable, false)
  assert.match(result.message, /better light/)
  assert.equal((await db.collection('Nutrition_Scans').get()).size, 0)
  assert.equal(result.remaining, 3)
})

test('free plan: the fourth scan of the day is refused; premium is unlimited', { skip }, async () => {
  await reset()
  await addUser('u10', { allergies: 'None' })
  const ai = fakeAi(labelAnswer)
  for (let i = 0; i < 3; i += 1) await analyzeLabel({ db, uid: 'u10', image: png, callAi: ai })
  assert.equal(await code(analyzeLabel({ db, uid: 'u10', image: png, callAi: ai })), 'resource-exhausted')
  assert.equal(ai.calls, 3)

  await addUser('u11', { allergies: 'None' })
  await db.collection('Subscriptions').add({ user_id: 'u11', status: 'active', expires_at: Timestamp.fromMillis(Date.now() + 86400000) })
  for (let i = 0; i < 5; i += 1) await analyzeLabel({ db, uid: 'u11', image: png, callAi: fakeAi(labelAnswer) })
  assert.equal((await db.collection('Nutrition_Scans').where('user_id', '==', 'u11').get()).size, 5)
})

test('label scan rejects unsupported or missing images', { skip }, async () => {
  await reset()
  await addUser('u12')
  const ai = fakeAi(labelAnswer)
  assert.equal(await code(analyzeLabel({ db, uid: 'u12', image: { mimeType: 'application/pdf', base64: 'aa' }, callAi: ai })), 'invalid-argument')
  assert.equal(await code(analyzeLabel({ db, uid: 'u12', image: null, callAi: ai })), 'invalid-argument')
  assert.equal(await code(analyzeLabel({ db, uid: 'u12', image: { mimeType: 'image/png', base64: 'a'.repeat(8 * 1024 * 1024) }, callAi: ai })), 'invalid-argument')
  assert.equal(ai.calls, 0)
})
