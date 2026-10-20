'use strict'

// The logic of the two AI features, kept separate from the Cloud Functions wrapper so it can be tested against the
// Firestore emulator with a fake Gemini (test/handlers.test.js). Every rule the client cannot be trusted with lives here:
// who may call, the critical-reading safety block, and the daily limits (Free, Premium fair use, whole project: usage.js).

const { FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const { interpretGlucose } = require('./glucose')
const { rateNutrients } = require('./rating')
const { allowanceFor, hasPremium } = require('./limits')
const { reserveSlot, usedToday } = require('./usage')
const {
  buildLabelPrompt, buildRecommendationPrompt, cleanExercises, cleanLabel, cleanMeals,
  exerciseSchema, labelSchema, mealSchema, parseAllergens, containsAllergen,
} = require('./prompts')

const CRITICAL_MESSAGE =
  'Your latest blood sugar reading is in a dangerous range. Please contact your doctor or go to the nearest hospital now. ' +
  'Suggestions are paused until your reading is back in range.'

// DECISIONS.md D25: suggestions, label scans and barcode ratings all avoid the person's allergens, so they need an
// answer to the allergy question first ("None" is an answer). Without one: no Gemini call and nothing counted.
const ALLERGIES_MESSAGE = 'Add your allergies first (or choose None if you have none) in Profile > Health Profile, so suggestions and scans can avoid them.'
const allergiesDeclared = (value) => (Array.isArray(value) ? value.some((item) => String(item).trim()) : String(value ?? '').trim().length > 0)
function requireAllergies(profile) {
  if (!allergiesDeclared(profile.allergies)) throw new HttpsError('failed-precondition', ALLERGIES_MESSAGE)
}

async function loadContext(db, uid) {
  const [userSnap, logs, subs] = await Promise.all([
    db.doc(`Users/${uid}`).get(),
    db.collection('Glucose_Logs').where('patient_id', '==', uid).get(),
    db.collection('Subscriptions').where('user_id', '==', uid).get(),
  ])
  const millis = (log) => (log.logged_at && log.logged_at.toMillis ? log.logged_at.toMillis() : 0)
  const latest = logs.docs.map((doc) => doc.data()).sort((a, b) => millis(b) - millis(a))[0] ?? null
  const reading = latest
    ? { ...latest, interpretation: interpretGlucose(Number(latest.reading_mgdl), latest.context === 'after_meal' ? 'after_meal' : 'before_meal') }
    : null
  return {
    profile: userSnap.data() ?? {},
    reading,
    premium: hasPremium(subs.docs.map((doc) => doc.data())),
  }
}

const validBarcode = (value) => typeof value === 'string' && /^[0-9]{6,14}$/.test(value)

// What the app is told is left today. Premium is "unlimited" in the app (a fair-use ceiling stays on the server), so null.
const remainingFor = (premium, limit, used) => (premium ? null : Math.max(0, limit - used))

/** Meal or exercise suggestions for the signed-in user. */
async function generateRecommendations({ db, uid, kind, callAi, now = new Date() }) {
  if (kind !== 'meal' && kind !== 'exercise') throw new HttpsError('invalid-argument', 'kind must be "meal" or "exercise".')

  const { profile, reading, premium } = await loadContext(db, uid)

  // Safety first: no suggestions (and no Gemini call, and nothing counted) for a critical reading.
  if (reading && reading.interpretation === 'critical') {
    return { blocked: true, reason: 'critical', message: CRITICAL_MESSAGE, items: [], remaining: null }
  }
  requireAllergies(profile)

  // Take a slot before anything else is done (refused with 429 at the limit); it is given back unless a suggestion is saved.
  const slot = await reserveSlot({ db, uid, feature: 'ai', premium, now })
  let keepSlot = false
  try {
    let foods = []
    if (kind === 'meal') {
      const snapshot = await db.collection('Food_Database').where('status', '==', 'active').limit(40).get()
      foods = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    }

    const allergens = parseAllergens(profile.allergies)
    const prompt = buildRecommendationPrompt({ kind, profile, reading, foods })
    let raw
    try {
      raw = await callAi({ system: prompt.system, user: prompt.user, schema: kind === 'meal' ? mealSchema : exerciseSchema })
    } catch {
      throw new HttpsError('unavailable', 'The suggestion service is busy right now. Please try again in a moment.')
    }

    const items = kind === 'meal' ? cleanMeals(raw?.items, allergens) : cleanExercises(raw?.items)
    if (!items.length) throw new HttpsError('unavailable', 'We could not prepare safe suggestions right now. Please try again.')

    const saved = await db.collection('AI_Suggestions').add({
      user_id: uid,
      suggestion_type: kind,
      prompt: prompt.user.slice(0, 1500),
      response: JSON.stringify(items),
      generated_at: FieldValue.serverTimestamp(),
    })
    keepSlot = true

    // Link the Filipino foods from the database that the suggestions actually name (AI_Suggestions_Foods).
    if (kind === 'meal') {
      await Promise.all(foods
        .filter((food) => items.some((meal) => `${meal.name} ${meal.ingredients.join(' ')}`.toLowerCase().includes(String(food.food_name ?? '').toLowerCase()) && food.food_name))
        .map((food) => db.collection('AI_Suggestions_Foods').add({ suggestion_id: saved.id, food_id: food.id })))
    }

    return { blocked: false, suggestion_id: saved.id, items, remaining: remainingFor(premium, slot.limit, slot.used) }
  } finally {
    if (!keepSlot) await slot.release()
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BASE64_LENGTH = 7 * 1024 * 1024 // about 5 MB of image

/** Reads a nutrition label photo for the signed-in user. The image is sent to Gemini and never stored (D2). */
async function analyzeLabel({ db, uid, image, barcode, callAi, now = new Date() }) {
  if (!image || typeof image.base64 !== 'string' || !IMAGE_TYPES.includes(image.mimeType)) {
    throw new HttpsError('invalid-argument', 'Send a JPEG, PNG or WebP photo of the label.')
  }
  if (image.base64.length > MAX_BASE64_LENGTH) throw new HttpsError('invalid-argument', 'That photo is too large. Try a smaller one.')

  const { profile, premium } = await loadContext(db, uid)
  requireAllergies(profile)
  // Take a slot before the Gemini call (refused with 429 at the limit); it is given back unless a scan is saved.
  const slot = await reserveSlot({ db, uid, feature: 'scan', premium, now })
  let keepSlot = false
  try {
    const allergens = parseAllergens(profile.allergies)
    const prompt = buildLabelPrompt({ profile })
    let raw
    try {
      raw = await callAi({ system: prompt.system, user: prompt.user, schema: labelSchema, image })
    } catch {
      throw new HttpsError('unavailable', 'The scanner is busy right now. Please try again in a moment.')
    }

    const result = cleanLabel(raw, allergens)
    if (!result.readable) {
      // Not saved, so a blurry photo does not use up one of the day's scans (the slot is given back below).
      return {
        readable: false,
        message: 'We could not read that label. Try again in better light, holding the camera steady.',
        remaining: remainingFor(premium, slot.limit, slot.used - 1),
      }
    }

    const saved = await db.collection('Nutrition_Scans').add({
      user_id: uid,
      image_url: null,
      product_name: result.product_name,
      health_rating: result.health_rating,
      scanned_at: FieldValue.serverTimestamp(),
      product_id: validBarcode(barcode) ? barcode : null,
      source: 'gemini_label',
      analysis: {
        ingredients_text: result.ingredients_text,
        brand: result.brand, serving_size: result.serving_size, calories: result.calories, carbs_g: result.carbs_g,
        sugar_g: result.sugar_g, fiber_g: result.fiber_g, protein_g: result.protein_g, sodium_mg: result.sodium_mg,
        insight: result.insight, allergen_warnings: result.allergen_warnings, alternatives: result.alternatives,
      },
    })
    keepSlot = true

    return { ...result, scan_id: saved.id, remaining: remainingFor(premium, slot.limit, slot.used) }
  } finally {
    if (!keepSlot) await slot.release()
  }
}

/**
 * Looks a barcode up in the shared Products collection (D12). Found: the saved nutrients are rated again for THIS
 * person (their allergies decide the warnings) and no Gemini call is made. Not found: the app then asks for a label photo.
 */
async function lookupProduct({ db, uid, barcode, now = new Date() }) {
  if (!validBarcode(barcode)) throw new HttpsError('invalid-argument', 'That barcode is not valid.')
  const snapshot = await db.doc(`Products/${barcode}`).get()
  if (!snapshot.exists) return { found: false }
  const product = snapshot.data()
  const { profile, premium } = await loadContext(db, uid)
  requireAllergies(profile)

  const nutrients = product.nutrients ?? {}
  const allergens = parseAllergens(profile.allergies)
  const matched = containsAllergen(`${product.product_name ?? ''} ${product.ingredients_text ?? ''}`, allergens)
  const rated = rateNutrients(nutrients)
  const rating = matched.length ? 'unsuitable' : rated.rating
  const alternatives = (Array.isArray(product.alternatives) ? product.alternatives : [])
    .filter((entry) => entry && entry.instead_of && entry.try && !containsAllergen(entry.try, allergens).length)
    .slice(0, 4)
  const analysis = {
    brand: product.brand ?? '',
    serving_size: product.serving_size ?? '',
    calories: nutrients.calories ?? 0,
    carbs_g: nutrients.carbs_g ?? 0,
    sugar_g: nutrients.sugar_g ?? 0,
    fiber_g: nutrients.fiber_g ?? 0,
    protein_g: nutrients.protein_g ?? 0,
    sodium_mg: nutrients.sodium_mg ?? 0,
    insight: rated.insight,
    allergen_warnings: matched.map((allergen) => `Contains ${allergen}`),
    alternatives,
    ingredients_text: product.ingredients_text ?? '',
  }

  const saved = await db.collection('Nutrition_Scans').add({
    user_id: uid,
    image_url: null,
    product_name: product.product_name,
    health_rating: rating,
    scanned_at: FieldValue.serverTimestamp(),
    product_id: barcode,
    source: 'product_memory',
    analysis,
  })
  // Only Gemini label scans use up the Free allowance, so this lookup reads the counter and never changes it.
  const used = await usedToday(db, uid, 'scan', now)

  return {
    found: true,
    readable: true,
    scan_id: saved.id,
    product_name: product.product_name,
    health_rating: rating,
    ...analysis,
    from_memory: true,
    verified: product.verified === true,
    barcode,
    remaining: remainingFor(premium, allowanceFor('scan', premium).limit, used),
  }
}

module.exports = { generateRecommendations, analyzeLabel, lookupProduct, CRITICAL_MESSAGE, ALLERGIES_MESSAGE, containsAllergen }
