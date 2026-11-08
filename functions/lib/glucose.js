'use strict'

// Blood sugar classification (mg/dL), DECISIONS.md D4 and D40. This is a copy of
// diabeatis360-mobile/src/constants/glucose.ts because the server cannot import from the app.
// test/glucose-parity.test.js fails if the two ever disagree.

const THRESHOLDS = {
  criticalLow: 54,
  low: 70,
  normalMax: { before_meal: 130, after_meal: 179 },
  // Prediabetes (D40): the normal ranges for people without diabetes, because the goal is to get back to them.
  prediabetesNormalMax: { before_meal: 99, after_meal: 139 },
  criticalHigh: 250,
}

/** The highest "normal" reading for this context and diabetes type (Type 1, Type 2 or not stated: the D4 targets). */
function normalMaxFor(context, diabetesType) {
  return (diabetesType === 'Prediabetes' ? THRESHOLDS.prediabetesNormalMax : THRESHOLDS.normalMax)[context]
}

function interpretGlucose(readingMgdl, context, diabetesType) {
  if (readingMgdl < THRESHOLDS.criticalLow || readingMgdl >= THRESHOLDS.criticalHigh) return 'critical'
  if (readingMgdl < THRESHOLDS.low) return 'low'
  if (readingMgdl > normalMaxFor(context, diabetesType)) return 'high'
  return 'normal'
}

module.exports = { THRESHOLDS, normalMaxFor, interpretGlucose }
