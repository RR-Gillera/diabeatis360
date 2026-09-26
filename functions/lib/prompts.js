'use strict'

// Everything about WHAT we ask Gemini and how we clean what comes back. Pure functions (no Firebase, no network),
// so they are unit-tested (test/prompts.test.js).
//
// Health-safety rules from the root CLAUDE.md are enforced here, not left to the model alone:
//   - the prompt carries the user's diabetes type and allergies and forbids diagnosis, medication changes and insulin doses;
//   - anything the model returns that mentions one of the user's allergens is removed before it reaches the app.

const SYSTEM_RULES = [
  'You are a nutrition and physical-activity assistant inside a diabetes self-management app for Filipino patients.',
  'You give general lifestyle guidance only. You NEVER diagnose, NEVER suggest starting, stopping or changing any medication,',
  'and NEVER give insulin or drug doses. If something sounds urgent, tell the person to contact their doctor.',
  'You MUST avoid every allergen the user lists, including as an ingredient.',
  'Prefer affordable, common Filipino foods and low glycemic index choices. Keep amounts realistic and portions moderate.',
  'Answer only with JSON that matches the requested schema. All numbers are plain numbers (no units).',
].join(' ')

const LANGUAGE_NAMES = { English: 'English', Filipino: 'Filipino (Tagalog)' }

/** "Peanuts, Shellfish; dairy" -> ['peanuts', 'shellfish', 'dairy']. "None" or empty -> []. */
function parseAllergens(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/)
  return list
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => item && !['none', 'no', 'n/a', 'na', 'wala', 'nothing'].includes(item))
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Which of the user's allergens appear in `text`. Matches whole words, singular or plural ("peanut" and "peanuts"),
 * so "peanut brittle" is caught for someone allergic to "peanuts" while "coconut" is not mistaken for "nut".
 */
function containsAllergen(text, allergens) {
  const haystack = String(text ?? '').toLowerCase()
  return allergens.filter((allergen) => {
    const singular = allergen.endsWith('s') ? allergen.slice(0, -1) : allergen
    const forms = new Set([allergen, singular, `${singular}s`])
    return [...forms].some((form) => form && new RegExp(`(^|[^a-z])${escapeRegExp(form)}($|[^a-z])`).test(haystack))
  })
}

function describeProfile(profile) {
  const allergens = parseAllergens(profile.allergies)
  return [
    `Diabetes type: ${profile.diabetes_type || 'not stated'}`,
    `Allergies (must avoid): ${allergens.length ? allergens.join(', ') : 'none declared'}`,
    `Dietary preference: ${profile.dietary_preference || 'not stated'}`,
    `Activity level: ${profile.activity_level || 'not stated'}`,
  ].join('\n')
}

function describeReading(reading) {
  if (!reading) return 'Latest blood sugar reading: none recorded yet.'
  const when = reading.context === 'after_meal' ? 'after a meal' : 'before a meal'
  return `Latest blood sugar reading: ${reading.reading_mgdl} mg/dL ${when} (classified ${reading.interpretation}).`
}

function describeFoods(foods) {
  if (!foods.length) return 'No food database is available; choose common Filipino foods you know the approximate nutrition of.'
  const lines = foods.map((food) => `- ${food.food_name} (GI ${food.glycemic_index ?? '?'}, ${food.category ?? 'food'}, ${food.calories ?? '?'} kcal)`)
  return `Prefer foods from this Filipino food list when suitable:\n${lines.join('\n')}`
}

function buildRecommendationPrompt({ kind, profile, reading, foods }) {
  const language = LANGUAGE_NAMES[profile.language_preference] ?? 'English'
  const task = kind === 'meal'
    ? 'Suggest exactly 3 different meal options for the person\'s NEXT meal. For each give the nutrition per serving and 4 to 7 simple ingredients.'
    : 'Suggest exactly 3 gentle physical activities suitable right now. For each give a realistic duration in minutes and a short caution. Never suggest strenuous exercise if the latest reading is low.'
  return {
    system: SYSTEM_RULES,
    user: [
      `Respond in ${language}.`,
      describeProfile(profile),
      describeReading(reading),
      kind === 'meal' ? describeFoods(foods) : '',
      task,
    ].filter(Boolean).join('\n\n'),
  }
}

function buildLabelPrompt({ profile }) {
  const language = LANGUAGE_NAMES[profile.language_preference] ?? 'English'
  return {
    system: SYSTEM_RULES,
    user: [
      `Respond in ${language}.`,
      describeProfile(profile),
      'The attached photo should show a food product\'s nutrition facts label. Read it carefully.',
      'If the label is not readable or is not a nutrition label, set "readable" to false and leave the other fields empty.',
      'Otherwise fill in the product name, brand and serving size, the nutrients PER SERVING, the ingredients text if visible,',
      'and judge how suitable the product is for THIS person (suitable, caution or unsuitable) with a short personalised insight.',
      'Add up to 4 "alternatives": common Filipino foods that are healthier swaps ("instead_of" -> "try").',
    ].join('\n\n'),
  }
}

// ---- response schemas (Gemini's OpenAPI subset) ------------------------------------------------------------
const NUMBER = { type: 'NUMBER' }
const STRING = { type: 'STRING' }

const mealSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: STRING, tagline: STRING, calories: NUMBER, protein_g: NUMBER, carbs_g: NUMBER, fiber_g: NUMBER, sugar_g: NUMBER,
          insight: STRING, ingredients: { type: 'ARRAY', items: STRING },
        },
        required: ['name', 'tagline', 'calories', 'protein_g', 'carbs_g', 'fiber_g', 'sugar_g', 'insight', 'ingredients'],
      },
    },
  },
  required: ['items'],
}

const exerciseSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: STRING, description: STRING, duration_minutes: NUMBER, intensity: STRING, caution: STRING },
        required: ['name', 'description', 'duration_minutes', 'intensity', 'caution'],
      },
    },
  },
  required: ['items'],
}

const labelSchema = {
  type: 'OBJECT',
  properties: {
    readable: { type: 'BOOLEAN' },
    product_name: STRING, brand: STRING, serving_size: STRING, ingredients_text: STRING,
    calories: NUMBER, carbs_g: NUMBER, sugar_g: NUMBER, fiber_g: NUMBER, protein_g: NUMBER, sodium_mg: NUMBER,
    health_rating: { type: 'STRING', enum: ['suitable', 'caution', 'unsuitable'] },
    insight: STRING,
    alternatives: { type: 'ARRAY', items: { type: 'OBJECT', properties: { instead_of: STRING, try: STRING }, required: ['instead_of', 'try'] } },
  },
  required: ['readable'],
}

// ---- cleaning what the model returns -----------------------------------------------------------------------
const text = (value, max = 240) => String(value ?? '').trim().slice(0, max)
const number = (value, max = 10000) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 10) / 10, max) : 0
}

/** Meals: keep well-formed ones and drop any that mention a declared allergen. */
function cleanMeals(items, allergens) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: text(item?.name, 80),
      tagline: text(item?.tagline, 120),
      calories: number(item?.calories, 3000),
      protein_g: number(item?.protein_g, 300),
      carbs_g: number(item?.carbs_g, 500),
      fiber_g: number(item?.fiber_g, 100),
      sugar_g: number(item?.sugar_g, 300),
      insight: text(item?.insight, 300),
      ingredients: (Array.isArray(item?.ingredients) ? item.ingredients : []).map((entry) => text(entry, 60)).filter(Boolean).slice(0, 10),
    }))
    .filter((meal) => meal.name && !containsAllergen(`${meal.name} ${meal.ingredients.join(' ')}`, allergens).length)
    .slice(0, 3)
}

function cleanExercises(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: text(item?.name, 80),
      description: text(item?.description, 240),
      duration_minutes: Math.max(5, Math.min(120, Math.round(number(item?.duration_minutes, 120)))),
      intensity: ['light', 'moderate'].includes(String(item?.intensity).toLowerCase()) ? String(item.intensity).toLowerCase() : 'light',
      caution: text(item?.caution, 200),
    }))
    .filter((exercise) => exercise.name)
    .slice(0, 3)
}

/** Scan result: numbers clamped, and an allergen in the ingredients forces a warning and an "unsuitable" rating. */
function cleanLabel(raw, allergens) {
  if (!raw || raw.readable === false) return { readable: false }
  const ingredientsText = text(raw.ingredients_text, 1200)
  const matched = containsAllergen(`${raw.product_name ?? ''} ${ingredientsText}`, allergens)
  let rating = ['suitable', 'caution', 'unsuitable'].includes(raw.health_rating) ? raw.health_rating : 'caution'
  if (matched.length) rating = 'unsuitable'
  return {
    readable: true,
    product_name: text(raw.product_name, 100) || 'Unknown product',
    brand: text(raw.brand, 80),
    serving_size: text(raw.serving_size, 60),
    calories: number(raw.calories, 3000),
    carbs_g: number(raw.carbs_g, 500),
    sugar_g: number(raw.sugar_g, 300),
    fiber_g: number(raw.fiber_g, 100),
    protein_g: number(raw.protein_g, 300),
    sodium_mg: number(raw.sodium_mg, 10000),
    health_rating: rating,
    insight: text(raw.insight, 400),
    allergen_warnings: matched.map((allergen) => `Contains ${allergen}`),
    alternatives: (Array.isArray(raw.alternatives) ? raw.alternatives : [])
      .map((entry) => ({ instead_of: text(entry?.instead_of, 60), try: text(entry?.try, 80) }))
      .filter((entry) => entry.instead_of && entry.try && !containsAllergen(entry.try, allergens).length)
      .slice(0, 4),
  }
}

module.exports = {
  parseAllergens, containsAllergen, buildRecommendationPrompt, buildLabelPrompt,
  mealSchema, exerciseSchema, labelSchema, cleanMeals, cleanExercises, cleanLabel, SYSTEM_RULES,
}
