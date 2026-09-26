'use strict'

// The logic of the two AI features, kept separate from the Cloud Functions wrapper so it can be tested against the
// Firestore emulator with a fake Gemini (test/handlers.test.js). Every rule the client cannot be trusted with lives here:
// who may call, the critical-reading safety block, and the Free-plan daily limits.

const { FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const { interpretGlucose } = require('./glucose')
const { checkLimit, countToday, hasPremium } = require('./limits')
const {
  buildLabelPrompt, buildRecommendationPrompt, cleanExercises, cleanLabel, cleanMeals,
  exerciseSchema, labelSchema, mealSchema, parseAllergens, containsAllergen,
} = require('./prompts')

const CRITICAL_MESSAGE =
  'Your latest blood sugar reading is in a dangerous range. Please contact your doctor or go to the nearest hospital now. ' +
  'Suggestions are paused until your reading is back in range.'

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

async function usedToday(db, collection, dateField, uid, now) {
  const snapshot = await db.collection(collection).where('user_id', '==', uid).get()
  return countToday(snapshot.docs.map((doc) => doc.data()[dateField]), now)
}

function limitError(feature, limit) {
  const what = feature === 'scan' ? 'label scans' : 'AI suggestions'
  return new HttpsError(
    'resource-exhausted',
    `You have used all ${limit} free ${what} for today. Upgrade to Premium for unlimited use, or try again tomorrow.`,
    { limit, feature },
  )
}

/** Meal or exercise suggestions for the signed-in user. */
async function generateRecommendations({ db, uid, kind, callAi, now = new Date() }) {
  if (kind !== 'meal' && kind !== 'exercise') throw new HttpsError('invalid-argument', 'kind must be "meal" or "exercise".')

  const { profile, reading, premium } = await loadContext(db, uid)

  // Safety first: no suggestions (and no Gemini call, and nothing counted) for a critical reading.
  if (reading && reading.interpretation === 'critical') {
    return { blocked: true, reason: 'critical', message: CRITICAL_MESSAGE, items: [], remaining: null }
  }

  const used = await usedToday(db, 'AI_Suggestions', 'generated_at', uid, now)
  const limit = checkLimit({ feature: 'ai', premium, usedToday: used })
  if (!limit.allowed) throw limitError('ai', limit.limit)

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

  // Link the Filipino foods from the database that the suggestions actually name (AI_Suggestions_Foods).
  if (kind === 'meal') {
    await Promise.all(foods
      .filter((food) => items.some((meal) => `${meal.name} ${meal.ingredients.join(' ')}`.toLowerCase().includes(String(food.food_name ?? '').toLowerCase()) && food.food_name))
      .map((food) => db.collection('AI_Suggestions_Foods').add({ suggestion_id: saved.id, food_id: food.id })))
  }

  return {
    blocked: false,
    suggestion_id: saved.id,
    items,
    remaining: limit.limit === null ? null : Math.max(0, limit.limit - used - 1),
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BASE64_LENGTH = 7 * 1024 * 1024 // about 5 MB of image

/** Reads a nutrition label photo for the signed-in user. The image is sent to Gemini and never stored (D2). */
async function analyzeLabel({ db, uid, image, callAi, now = new Date() }) {
  if (!image || typeof image.base64 !== 'string' || !IMAGE_TYPES.includes(image.mimeType)) {
    throw new HttpsError('invalid-argument', 'Send a JPEG, PNG or WebP photo of the label.')
  }
  if (image.base64.length > MAX_BASE64_LENGTH) throw new HttpsError('invalid-argument', 'That photo is too large. Try a smaller one.')

  const { profile, premium } = await loadContext(db, uid)
  const used = await usedToday(db, 'Nutrition_Scans', 'scanned_at', uid, now)
  const limit = checkLimit({ feature: 'scan', premium, usedToday: used })
  if (!limit.allowed) throw limitError('scan', limit.limit)

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
    // Not saved, so a blurry photo does not use up one of the day's scans.
    return { readable: false, message: 'We could not read that label. Try again in better light, holding the camera steady.', remaining: limit.limit === null ? null : limit.limit - used }
  }

  const saved = await db.collection('Nutrition_Scans').add({
    user_id: uid,
    image_url: null,
    product_name: result.product_name,
    health_rating: result.health_rating,
    scanned_at: FieldValue.serverTimestamp(),
    analysis: {
      brand: result.brand, serving_size: result.serving_size, calories: result.calories, carbs_g: result.carbs_g,
      sugar_g: result.sugar_g, fiber_g: result.fiber_g, protein_g: result.protein_g, sodium_mg: result.sodium_mg,
      insight: result.insight, allergen_warnings: result.allergen_warnings, alternatives: result.alternatives,
    },
  })

  return { ...result, scan_id: saved.id, remaining: limit.limit === null ? null : Math.max(0, limit.limit - used - 1) }
}

module.exports = { generateRecommendations, analyzeLabel, CRITICAL_MESSAGE, containsAllergen }
