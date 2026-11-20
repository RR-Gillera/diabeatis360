'use strict'

// The logic of the two AI features, kept separate from the Cloud Functions wrapper so it can be tested against the
// Firestore emulator with a fake Gemini (test/handlers.test.js). Every rule the client cannot be trusted with lives here:
// who may call, the critical-reading safety block, and the daily limits (Free, Premium fair use, whole project: usage.js).

const { FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const { interpretGlucose } = require('./glucose')
const { hasPremium, startOfManilaDay } = require('./limits')
const { assessRisk } = require('./risk')
const { reserveSlot } = require('./usage')
const {
  buildLabelPrompt, buildRecommendationPrompt, buildRiskPrompt, cleanExercises, cleanLabel, cleanMeals, cleanRiskAdvice,
  diabetesTypeOf, dislikedIngredients, exerciseSchema, labelSchema, mealSchema, parseAllergens, containsAllergen, riskSchema,
} = require('./prompts')

const CRITICAL_MESSAGE =
  'Your latest blood sugar reading is in a dangerous range. Please contact your doctor or go to the nearest hospital now. ' +
  'Suggestions are paused until your reading is back in range.'

// DECISIONS.md D25: suggestions and label scans both avoid the person's allergens, so they need an
// answer to the allergy question first ("None" is an answer). Without one: no Gemini call and nothing counted.
const ALLERGIES_MESSAGE = 'Add your allergies first (or tap "I don\'t have food allergies") in Profile > Health Profile, so suggestions and scans can avoid them.'
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
  const profile = userSnap.data() ?? {}
  // Classified for this person's diabetes type (D40): a prediabetes reading of 115 before a meal is high, not normal.
  const reading = latest
    ? { ...latest, interpretation: interpretGlucose(Number(latest.reading_mgdl), latest.context === 'after_meal' ? 'after_meal' : 'before_meal', diabetesTypeOf(profile.diabetes_type)) }
    : null
  return {
    profile,
    reading,
    premium: hasPremium(subs.docs.map((doc) => doc.data())),
  }
}

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

    // A meal is dropped if it has an allergen or an ingredient the person does not eat (D40).
    const avoid = [...parseAllergens(profile.allergies), ...dislikedIngredients(profile)]
    const prompt = buildRecommendationPrompt({ kind, profile, reading, foods })
    let raw
    try {
      raw = await callAi({ system: prompt.system, user: prompt.user, schema: kind === 'meal' ? mealSchema : exerciseSchema })
    } catch {
      throw new HttpsError('unavailable', 'The suggestion service is busy right now. Please try again in a moment.')
    }

    const items = kind === 'meal' ? cleanMeals(raw?.items, avoid) : cleanExercises(raw?.items)
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
async function analyzeLabel({ db, uid, image, callAi, now = new Date() }) {
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

    const result = cleanLabel(raw, allergens, dislikedIngredients(profile))
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
 * AI Diabetes Risk Prediction (DECISIONS.md D51). The level comes from the fixed rule in risk.js; Gemini only explains
 * it and gives advice. Order of the checks, each of which ends the request:
 *   1. the latest reading is critical  -> the emergency message, the rule's level, no Gemini call (like the other AI);
 *   2. an assessment was already made today (Manila day) -> that one again, no Gemini call;
 *   3. fewer than 5 readings in 14 days -> "not enough readings", no Gemini call, nothing saved;
 *   4. no allergy answer -> refused like the other AI features (the advice may name foods);
 * then one daily 'risk' slot is taken (it also counts toward the project-wide Gemini cap), Gemini is asked, the advice is
 * cleaned, and the result is saved in AI_Suggestions with suggestion_type 'risk'. It never uses up the Free plan's
 * meal/exercise generations.
 */
async function predictRisk({ db, uid, callAi, now = new Date() }) {
  const [userSnap, logsSnap, subsSnap, savedSnap] = await Promise.all([
    db.doc(`Users/${uid}`).get(),
    db.collection('Glucose_Logs').where('patient_id', '==', uid).get(),
    db.collection('Subscriptions').where('user_id', '==', uid).get(),
    db.collection('AI_Suggestions').where('user_id', '==', uid).get(),
  ])
  const profile = userSnap.data() ?? {}
  const logs = logsSnap.docs.map((doc) => doc.data())
  const millis = (log) => (log.logged_at && log.logged_at.toMillis ? log.logged_at.toMillis() : 0)
  const latest = [...logs].sort((a, b) => millis(b) - millis(a))[0]

  if (latest) {
    const latestClass = interpretGlucose(Number(latest.reading_mgdl), latest.context === 'after_meal' ? 'after_meal' : 'before_meal', diabetesTypeOf(profile.diabetes_type))
    if (latestClass === 'critical') {
      const assessment = assessRisk({ logs, profile, now })
      return { status: 'critical', message: CRITICAL_MESSAGE, assessment: assessment.enough ? assessment : null }
    }
  }

  const todayStart = startOfManilaDay(now).getTime()
  const savedToday = savedSnap.docs
    .map((doc) => doc.data())
    .filter((data) => data.suggestion_type === 'risk' && data.generated_at && data.generated_at.toMillis() >= todayStart)
    .sort((a, b) => b.generated_at.toMillis() - a.generated_at.toMillis())[0]
  if (savedToday) {
    try {
      const { assessment, advice } = JSON.parse(savedToday.response)
      return { status: 'ok', cached: true, assessed_at: savedToday.generated_at.toDate().toISOString(), assessment, advice }
    } catch {
      // An unreadable saved result is ignored and a new one is made below.
    }
  }

  const assessment = assessRisk({ logs, profile, now })
  if (!assessment.enough) return { status: 'not_enough', readings_recent: assessment.readings_recent, needed: assessment.needed }
  requireAllergies(profile)

  const premium = hasPremium(subsSnap.docs.map((doc) => doc.data()), now)
  const slot = await reserveSlot({ db, uid, feature: 'risk', premium, now })
  let keepSlot = false
  try {
    const prompt = buildRiskPrompt({ profile, assessment })
    let raw
    try {
      raw = await callAi({ system: prompt.system, user: prompt.user, schema: riskSchema })
    } catch {
      throw new HttpsError('unavailable', 'The risk assessment service is busy right now. Please try again in a moment.')
    }
    const advice = cleanRiskAdvice(raw, [...parseAllergens(profile.allergies), ...dislikedIngredients(profile)])
    if (!advice.summary && !advice.prevention.length && !advice.maintenance.length) {
      throw new HttpsError('unavailable', 'We could not prepare safe advice right now. Please try again.')
    }

    await db.collection('AI_Suggestions').add({
      user_id: uid,
      suggestion_type: 'risk',
      prompt: prompt.user.slice(0, 1500),
      response: JSON.stringify({ assessment, advice }),
      generated_at: FieldValue.serverTimestamp(),
    })
    keepSlot = true
    return { status: 'ok', cached: false, assessed_at: now.toISOString(), assessment, advice }
  } finally {
    if (!keepSlot) await slot.release()
  }
}

module.exports = { generateRecommendations, analyzeLabel, predictRisk, CRITICAL_MESSAGE, ALLERGIES_MESSAGE, containsAllergen }
