'use strict'

// Everything about WHAT we ask Gemini and how we clean what comes back. Pure functions (no Firebase, no network),
// so they are unit-tested (test/prompts.test.js).
//
// Health-safety rules from the root CLAUDE.md are enforced here, not left to the model alone:
//   - the prompt carries the user's diabetes type and allergies and forbids diagnosis, medication changes and insulin doses;
//   - anything the model returns that mentions one of the user's allergens is removed before it reaches the app.
// Since DECISIONS.md D40 the prompt also carries advice for the person's diabetes type and the ingredients they do not
// eat, and those ingredients are removed the same way. Both checks know each food's other names (food-words.js), so
// "Pork" also catches "lechon" and "baboy".

const { wordsFor } = require('./food-words')

const SYSTEM_RULES = [
  'You are a nutrition and physical-activity assistant inside a diabetes self-management app for Filipino patients.',
  'You give general lifestyle guidance only. You NEVER diagnose, NEVER suggest starting, stopping or changing any medication,',
  'and NEVER give insulin or drug doses. If something sounds urgent, tell the person to contact their doctor.',
  'You MUST avoid every allergen the user lists, including as an ingredient.',
  'You MUST also leave out every ingredient the user says they do not eat.',
  'Prefer affordable, common Filipino foods and low glycemic index choices. Keep amounts realistic and portions moderate.',
  'Answer only with JSON that matches the requested schema. All numbers are plain numbers (no units).',
].join(' ')

const LANGUAGE_NAMES = { English: 'English', Filipino: 'Filipino (Tagalog)' }

// What each diabetes type changes in the advice (DECISIONS.md D40). General lifestyle guidance only: never medicine and
// never insulin amounts (SYSTEM_RULES). A type that is not stated gets no extra line.
const TYPE_GUIDANCE = {
  'Type 1': {
    meal: 'Type 1 diabetes: keep the carbohydrates in each meal moderate and steady from meal to meal, and make carbs_g accurate, because the person plans their insulin around it. Never mention insulin amounts.',
    exercise: 'Type 1 diabetes: activity can lower blood sugar during it and for hours after. Every caution must remind the person to check their blood sugar before starting and to keep a fast-acting sugar snack, such as candy or juice, within reach.',
    label: 'Type 1 diabetes: judge the product mainly by its carbohydrates and sugar per serving, and give the grams of carbohydrate in one serving in the insight.',
  },
  'Type 2': {
    meal: 'Type 2 diabetes: favour high-fibre, low glycemic index meals with vegetables and lean protein, a controlled portion of rice (about one cup of cooked rice or less, brown rice when possible), and no sugary drinks.',
    exercise: 'Type 2 diabetes: favour regular moderate activity, such as a brisk walk after meals, which helps lower blood sugar. Every caution must say to stop and check their blood sugar if they feel shaky, dizzy or sweaty.',
    label: 'Type 2 diabetes: judge the product by its sugar, refined carbohydrates, fibre and sodium per serving.',
  },
  Prediabetes: {
    meal: 'Prediabetes: the goal is to prevent type 2 diabetes. Suggest simple swaps the person can keep up: smaller portions of white rice, no sugary drinks, more vegetables, fibre and lean protein, and portions that support a healthy weight.',
    exercise: 'Prediabetes: the goal is to prevent type 2 diabetes. Encourage building up to about 150 minutes of moderate activity a week, such as brisk walking.',
    label: 'Prediabetes: judge the product by its added sugar, refined carbohydrates and fibre, and say how it fits eating to prevent type 2 diabetes.',
  },
}

// Older app versions saved 'Pre-Diabetic'; the app's code is 'Prediabetes' (DECISIONS.md D25).
const diabetesTypeOf = (value) => (/^pre-?diabet(ic|es)$/i.test(String(value ?? '').trim()) ? 'Prediabetes' : String(value ?? '').trim())

// The diet choices are Everything and Vegetarian (D40). Older answers still work: 'Diabetic Diet' is Everything (the
// advice is for a person with diabetes anyway) and 'No Pork' is Everything with pork among the ingredients not eaten.
function dietOf(value) {
  const diet = String(value ?? '').trim()
  if (!diet) return 'not stated'
  return diet === 'Vegetarian' ? 'Vegetarian' : 'Everything'
}

/** "Peanuts, Shellfish; dairy" -> ['peanuts', 'shellfish', 'dairy']. "None" or empty -> []. Also reads the ingredients someone does not eat. */
function parseAllergens(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/)
  return list
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => item && !['none', 'no', 'n/a', 'na', 'wala', 'nothing'].includes(item))
}

/** The ingredients someone does not eat (Users.disliked_ingredients, D40), with pork for an old 'No Pork' answer. */
function dislikedIngredients(profile) {
  const list = parseAllergens(profile.disliked_ingredients)
  if (String(profile.dietary_preference ?? '').trim() === 'No Pork' && !list.includes('pork')) list.push('pork')
  return list
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Which of `items` (allergens, or ingredients someone does not eat) appear in `text`, on whole words only. A listed
 * food also counts under its other names (food-words.js), so "Sinigang na Hipon" is caught for "Seafood"; a typed one
 * counts in singular or plural ("peanut brittle" for "peanuts"). "coconut" is never mistaken for "nut".
 */
function containsAllergen(text, items) {
  const haystack = String(text ?? '').toLowerCase()
  return items.filter((item) => wordsFor(item).some((word) => new RegExp(`(^|[^a-z])${escapeRegExp(word)}($|[^a-z])`).test(haystack)))
}

/** The person, as the prompt describes them. `kind` ('meal', 'exercise' or 'label') picks the advice for their type. */
function describeProfile(profile, kind) {
  const allergens = parseAllergens(profile.allergies)
  const disliked = dislikedIngredients(profile)
  const type = diabetesTypeOf(profile.diabetes_type)
  return [
    `Diabetes type: ${type || 'not stated'}`,
    `Allergies (must avoid): ${allergens.length ? allergens.join(', ') : 'none declared'}`,
    `Ingredients they do not eat (never use): ${disliked.length ? disliked.join(', ') : 'none'}`,
    `Dietary preference: ${dietOf(profile.dietary_preference)}`,
    `Activity level: ${profile.activity_level || 'not stated'}`,
    TYPE_GUIDANCE[type]?.[kind] ?? '',
  ].filter(Boolean).join('\n')
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
    : 'Suggest exactly 3 gentle physical activities suitable right now. For each give a short tagline, a one-sentence description, a realistic duration in minutes, exactly 3 short benefits, and a short caution. Never suggest strenuous exercise if the latest reading is low.'
  return {
    system: SYSTEM_RULES,
    user: [
      `Respond in ${language}.`,
      describeProfile(profile, kind),
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
      describeProfile(profile, 'label'),
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
        properties: { name: STRING, tagline: STRING, description: STRING, duration_minutes: NUMBER, intensity: STRING, benefits: { type: 'ARRAY', items: STRING }, caution: STRING },
        required: ['name', 'tagline', 'description', 'duration_minutes', 'intensity', 'benefits', 'caution'],
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

/** Meals: keep well-formed ones and drop any that mention something to avoid (an allergen or an ingredient not eaten). */
function cleanMeals(items, avoid) {
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
    .filter((meal) => meal.name && !containsAllergen(`${meal.name} ${meal.ingredients.join(' ')}`, avoid).length)
    .slice(0, 3)
}

function cleanExercises(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: text(item?.name, 80),
      tagline: text(item?.tagline, 80),
      description: text(item?.description, 240),
      benefits: (Array.isArray(item?.benefits) ? item.benefits : []).map((entry) => text(entry, 100)).filter(Boolean).slice(0, 3),
      duration_minutes: Math.max(5, Math.min(120, Math.round(number(item?.duration_minutes, 120)))),
      intensity: ['light', 'moderate'].includes(String(item?.intensity).toLowerCase()) ? String(item.intensity).toLowerCase() : 'light',
      caution: text(item?.caution, 200),
    }))
    .filter((exercise) => exercise.name)
    .slice(0, 3)
}

/**
 * Scan result: numbers clamped, and an allergen in the ingredients forces a warning and an "unsuitable" rating. A
 * healthier alternative is dropped when it has an allergen or an ingredient the person does not eat (`disliked`).
 */
function cleanLabel(raw, allergens, disliked = []) {
  if (!raw || raw.readable === false) return { readable: false }
  const ingredientsText = text(raw.ingredients_text, 1200)
  const matched = containsAllergen(`${raw.product_name ?? ''} ${ingredientsText}`, allergens)
  let rating = ['suitable', 'caution', 'unsuitable'].includes(raw.health_rating) ? raw.health_rating : 'caution'
  if (matched.length) rating = 'unsuitable'
  return {
    readable: true,
    product_name: text(raw.product_name, 100) || 'Unknown product',
    ingredients_text: ingredientsText,
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
      .filter((entry) => entry.instead_of && entry.try && !containsAllergen(entry.try, [...allergens, ...disliked]).length)
      .slice(0, 4),
  }
}

module.exports = {
  parseAllergens, dislikedIngredients, diabetesTypeOf, containsAllergen, buildRecommendationPrompt, buildLabelPrompt, TYPE_GUIDANCE,
  mealSchema, exerciseSchema, labelSchema, cleanMeals, cleanExercises, cleanLabel, SYSTEM_RULES,
}
