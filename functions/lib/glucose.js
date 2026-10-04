'use strict'

// Blood sugar classification (mg/dL), DECISIONS.md D4. This is a copy of
// diabeatis360-mobile/src/constants/glucose.ts because the server cannot import from the app.
// test/glucose-parity.test.js fails if the two ever disagree.

const THRESHOLDS = {
  criticalLow: 54,
  low: 70,
  normalMax: { before_meal: 130, after_meal: 179 },
  criticalHigh: 250,
}

function interpretGlucose(readingMgdl, context) {
  if (readingMgdl < THRESHOLDS.criticalLow || readingMgdl >= THRESHOLDS.criticalHigh) return 'critical'
  if (readingMgdl < THRESHOLDS.low) return 'low'
  if (readingMgdl > THRESHOLDS.normalMax[context]) return 'high'
  return 'normal'
}

module.exports = { THRESHOLDS, interpretGlucose }
