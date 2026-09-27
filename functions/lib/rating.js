'use strict'

// Health rating for a product that is already in the shared Products collection (DECISIONS.md D12). No Gemini call
// is made for these, so the rating is a plain rule on the saved nutrients, worked out again for every person.
// The cut-offs are per serving. They are a starting point for a student project and should be confirmed by a
// dietitian or the adviser before real use; changing them here is the only place to do it.
const LIMITS = {
  sugar_g: { caution: 8, unsuitable: 15 },
  carbs_g: { caution: 30, unsuitable: 45 },
  sodium_mg: { caution: 400, unsuitable: 800 },
}

const LABELS = { sugar_g: 'sugar', carbs_g: 'carbohydrates', sodium_mg: 'sodium' }
const UNITS = { sugar_g: 'g', carbs_g: 'g', sodium_mg: 'mg' }
const RANK = { suitable: 0, caution: 1, unsuitable: 2 }

function levelOf(key, value) {
  if (value >= LIMITS[key].unsuitable) return 'unsuitable'
  if (value >= LIMITS[key].caution) return 'caution'
  return 'suitable'
}

/** { rating, insight } for one serving. The worst nutrient decides the rating and is named in the insight. */
function rateNutrients(nutrients) {
  let rating = 'suitable'
  let worst = null
  for (const key of Object.keys(LIMITS)) {
    const value = Number(nutrients && nutrients[key]) || 0
    const level = levelOf(key, value)
    if (RANK[level] > RANK[rating]) {
      rating = level
      worst = { key, value }
    }
  }
  if (!worst) return { rating, insight: 'Its sugar, carbohydrates and sodium per serving are within a reasonable range. Keep to one serving.' }
  const high = rating === 'unsuitable'
  return {
    rating,
    insight:
      `One serving has ${worst.value} ${UNITS[worst.key]} of ${LABELS[worst.key]}, which is ${high ? 'high' : 'on the high side'} for someone managing diabetes. ` +
      (high ? 'It is best to avoid it or take a very small portion.' : 'Take a small portion and check your blood sugar afterwards.'),
  }
}

module.exports = { LIMITS, rateNutrients }
