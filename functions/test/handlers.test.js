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
const { FREE_LIMITS, PREMIUM_LIMITS, manilaDayKey } = require('../lib/limits')

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
  for (const name of ['Users', 'Glucose_Logs', 'Subscriptions', 'AI_Suggestions', 'AI_Suggestions_Foods', 'Nutrition_Scans', 'Food_Database', 'Usage_Counters']) {
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

// ---- product memory (D12) ------------------------------------------------------------------------------------
const { lookupProduct } = require('../lib/handlers')
const barBarcode = '4800016123456'
const addProduct = (extra = {}) => db.doc(`Products/${barBarcode}`).set({
  barcode: barBarcode, product_name: 'Berry Energy Bar', brand: 'Acme', serving_size: '45 g', ingredients_text: 'oats, sugar, peanuts, berries',
  nutrients: { calories: 250, carbs_g: 45, sugar_g: 22, fiber_g: 2, protein_g: 5, sodium_mg: 150 },
  alternatives: [{ instead_of: 'Energy bar', try: 'Fresh guava' }, { instead_of: 'Candy', try: 'Peanut brittle' }],
  verified: false, ...extra,
})

test('product memory: a barcode that is not saved yet is reported as not found', { skip }, async () => {
  await reset()
  await addUser('u13')
  assert.deepEqual(await lookupProduct({ db, uid: 'u13', barcode: barBarcode }), { found: false })
  assert.equal(await code(lookupProduct({ db, uid: 'u13', barcode: 'abc' })), 'invalid-argument')
})

test('product memory: a hit is rated per person, warns about their allergy, and makes no Gemini call or scan count', { skip }, async () => {
  await reset()
  await db.collection('Products').doc(barBarcode).delete()
  await addProduct()
  await addUser('u14', { allergies: 'peanuts' })
  await addUser('u15', { allergies: 'shellfish' })

  const peanut = await lookupProduct({ db, uid: 'u14', barcode: barBarcode })
  assert.equal(peanut.found, true)
  assert.equal(peanut.from_memory, true)
  assert.equal(peanut.verified, false)
  assert.equal(peanut.health_rating, 'unsuitable')
  assert.deepEqual(peanut.allergen_warnings, ['Contains peanuts'])
  assert.deepEqual(peanut.alternatives, [{ instead_of: 'Energy bar', try: 'Fresh guava' }]) // the peanut swap is filtered out

  const other = await lookupProduct({ db, uid: 'u15', barcode: barBarcode })
  assert.equal(other.allergen_warnings.length, 0)
  assert.equal(other.health_rating, 'unsuitable') // 22 g sugar per serving is high for everyone
  assert.equal(other.alternatives.length, 2)

  // The lookups are saved as scans linked to the product, but do not use up any of the 3 Free scans.
  const scans = await db.collection('Nutrition_Scans').where('user_id', '==', 'u14').get()
  assert.equal(scans.docs[0].data().product_id, barBarcode)
  for (let i = 0; i < 3; i += 1) await analyzeLabel({ db, uid: 'u14', image: png, callAi: fakeAi(labelAnswer) })
  assert.equal(await code(analyzeLabel({ db, uid: 'u14', image: png, callAi: fakeAi(labelAnswer) })), 'resource-exhausted')
  assert.equal((await lookupProduct({ db, uid: 'u14', barcode: barBarcode })).found, true) // still works at the limit
})

test('product memory: a label scan with a barcode links the scan to the product', { skip }, async () => {
  await reset()
  await addUser('u16')
  const result = await analyzeLabel({ db, uid: 'u16', image: png, barcode: barBarcode, callAi: fakeAi(labelAnswer) })
  const scan = (await db.doc(`Nutrition_Scans/${result.scan_id}`).get()).data()
  assert.equal(scan.product_id, barBarcode)
  assert.equal(scan.source, 'gemini_label')
  assert.equal(result.ingredients_text, 'oats, sugar, peanuts, berries')
})

// ---- daily limits, fair use and the project-wide cap (D20) ---------------------------------------------------
const failure = async (promise) => { try { await promise; return null } catch (error) { return error } }
const counter = async (id) => (await db.doc(`Usage_Counters/${id}`).get()).data() ?? {}
const addPremium = (uid) => db.collection('Subscriptions').add({ user_id: uid, status: 'active', expires_at: Timestamp.fromMillis(Date.now() + 86400000) })

test('requests sent at the same moment cannot go past the Free limit (the slot is taken atomically)', { skip }, async () => {
  await reset()
  await addUser('r1', { allergies: 'None' })
  const ai = fakeAi(exercisesAnswer)
  const outcomes = await Promise.all(Array.from({ length: 6 }, () => failure(generateRecommendations({ db, uid: 'r1', kind: 'exercise', callAi: ai }))))
  const refused = outcomes.filter(Boolean)
  assert.equal(outcomes.length - refused.length, FREE_LIMITS.ai, 'exactly the Free limit got through')
  assert.ok(refused.every((error) => error.code === 'resource-exhausted'), `unexpected failures: ${refused.map((error) => error.code)}`)
  assert.equal(ai.calls, FREE_LIMITS.ai, 'Gemini was asked only as often as allowed')
  assert.equal((await db.collection('AI_Suggestions').get()).size, FREE_LIMITS.ai)
  assert.equal((await counter(`${manilaDayKey()}_r1`)).ai, FREE_LIMITS.ai)

  await addUser('r2', { allergies: 'None' })
  const scanAi = fakeAi(labelAnswer)
  const scans = await Promise.all(Array.from({ length: 6 }, () => failure(analyzeLabel({ db, uid: 'r2', image: png, callAi: scanAi }))))
  assert.equal(scans.filter((error) => !error).length, FREE_LIMITS.scan)
  assert.ok(scans.filter(Boolean).every((error) => error.code === 'resource-exhausted'))
  assert.equal(scanAi.calls, FREE_LIMITS.scan)
})

test('premium is "unlimited" in the app, but a fair-use ceiling stops a runaway account', { skip }, async () => {
  await reset()
  await addUser('pr1', { allergies: 'None' })
  await addPremium('pr1')
  const ai = fakeAi(exercisesAnswer)
  for (let i = 0; i < PREMIUM_LIMITS.ai; i += 1) await generateRecommendations({ db, uid: 'pr1', kind: 'exercise', callAi: ai })
  const refused = await failure(generateRecommendations({ db, uid: 'pr1', kind: 'exercise', callAi: ai }))
  assert.equal(refused.code, 'resource-exhausted')
  assert.equal(refused.details.scope, 'fair_use')
  assert.doesNotMatch(refused.message, /upgrade/i, 'a Premium person is not told to upgrade')
  assert.equal(ai.calls, PREMIUM_LIMITS.ai)

  // Scans have their own ceiling, so reaching one does not block the other.
  const scanAi = fakeAi(labelAnswer)
  for (let i = 0; i < PREMIUM_LIMITS.scan; i += 1) await analyzeLabel({ db, uid: 'pr1', image: png, callAi: scanAi })
  assert.equal((await failure(analyzeLabel({ db, uid: 'pr1', image: png, callAi: scanAi }))).details.scope, 'fair_use')
  assert.equal(scanAi.calls, PREMIUM_LIMITS.scan)
})

test('the Free refusal says why and offers Premium; its details tell the app which kind of limit it was', { skip }, async () => {
  await reset()
  await addUser('fr1', { allergies: 'None' })
  const ai = fakeAi(exercisesAnswer)
  for (let i = 0; i < FREE_LIMITS.ai; i += 1) await generateRecommendations({ db, uid: 'fr1', kind: 'exercise', callAi: ai })
  const refused = await failure(generateRecommendations({ db, uid: 'fr1', kind: 'exercise', callAi: ai }))
  assert.deepEqual(refused.details, { limit: FREE_LIMITS.ai, feature: 'ai', scope: 'free' })
  assert.match(refused.message, /Upgrade to Premium/)
})

test('the whole project has a daily cap; a product lookup, which uses no Gemini, still works at the cap', { skip }, async () => {
  await reset()
  const before = process.env.GEMINI_DAILY_CAP
  process.env.GEMINI_DAILY_CAP = '3'
  try {
    const ai = fakeAi(exercisesAnswer)
    for (const uid of ['c1', 'c2', 'c3']) {
      await addUser(uid, { allergies: 'None' })
      await generateRecommendations({ db, uid, kind: 'exercise', callAi: ai })
    }
    await addUser('c4', { allergies: 'None' })
    const refused = await failure(generateRecommendations({ db, uid: 'c4', kind: 'exercise', callAi: ai }))
    assert.equal(refused.code, 'resource-exhausted')
    assert.equal(refused.details.scope, 'project')
    assert.doesNotMatch(refused.message, /upgrade/i, 'upgrading cannot help when everyone is at the cap')
    assert.equal(ai.calls, 3)
    assert.equal((await counter(manilaDayKey())).gemini, 3)
    assert.equal((await counter(`${manilaDayKey()}_c4`)).ai ?? 0, 0, 'a refused request is not counted against the person')

    // Label scans share the same project cap ...
    assert.equal((await failure(analyzeLabel({ db, uid: 'c4', image: png, callAi: fakeAi(labelAnswer) }))).details.scope, 'project')
    // ... but a product answered from the shared Products collection makes no Gemini call.
    await addProduct()
    assert.equal((await lookupProduct({ db, uid: 'c4', barcode: barBarcode })).found, true)
  } finally {
    if (before === undefined) delete process.env.GEMINI_DAILY_CAP
    else process.env.GEMINI_DAILY_CAP = before
  }
})

test('a failed Gemini call, an unreadable photo or an unsafe answer gives the slot back', { skip }, async () => {
  await reset()
  const day = manilaDayKey()
  const failing = async () => { throw new Error('boom') }
  const unsafe = { items: [{ name: 'Peanut soup', ingredients: ['peanuts'] }] }

  await addUser('f1', { allergies: 'peanuts' })
  for (let i = 0; i < 3; i += 1) assert.equal(await code(generateRecommendations({ db, uid: 'f1', kind: 'meal', callAi: failing })), 'unavailable')
  assert.equal(await code(generateRecommendations({ db, uid: 'f1', kind: 'meal', callAi: fakeAi(unsafe) })), 'unavailable', 'nothing safe was left after the allergen filter')
  // Four failed attempts used nothing: both counters are back to zero ...
  assert.equal((await counter(`${day}_f1`)).ai, 0)
  assert.equal((await counter(day)).gemini, 0)
  // ... so the whole Free allowance is still there.
  const ai = fakeAi(exercisesAnswer)
  for (let i = 0; i < FREE_LIMITS.ai; i += 1) await generateRecommendations({ db, uid: 'f1', kind: 'exercise', callAi: ai })
  assert.equal(await code(generateRecommendations({ db, uid: 'f1', kind: 'exercise', callAi: ai })), 'resource-exhausted')

  // A Gemini failure and a blurry photo do not use up a scan either.
  await addUser('f3', { allergies: 'None' })
  assert.equal(await code(analyzeLabel({ db, uid: 'f3', image: png, callAi: failing })), 'unavailable')
  assert.equal((await analyzeLabel({ db, uid: 'f3', image: png, callAi: fakeAi({ readable: false }) })).readable, false)
  assert.equal((await counter(`${day}_f3`)).scan, 0)
})

test('the allowance starts again on the next Manila day, not at midnight UTC', { skip }, async () => {
  await reset()
  await addUser('d1', { allergies: 'None' })
  const ai = fakeAi(exercisesAnswer)
  const noonManila = new Date('2026-10-12T04:00:00Z')
  for (let i = 0; i < FREE_LIMITS.ai; i += 1) await generateRecommendations({ db, uid: 'd1', kind: 'exercise', callAi: ai, now: noonManila })
  assert.equal(await code(generateRecommendations({ db, uid: 'd1', kind: 'exercise', callAi: ai, now: noonManila })), 'resource-exhausted')
  // 23:59 in Manila (15:59 UTC) is still the same day; 00:00 Manila (16:00 UTC) is a new one.
  assert.equal(await code(generateRecommendations({ db, uid: 'd1', kind: 'exercise', callAi: ai, now: new Date('2026-10-12T15:59:00Z') })), 'resource-exhausted')
  assert.equal(await code(generateRecommendations({ db, uid: 'd1', kind: 'exercise', callAi: ai, now: new Date('2026-10-12T16:00:00Z') })), 'ok')
})
