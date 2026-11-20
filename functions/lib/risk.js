'use strict'

// AI Diabetes Risk Prediction: the RULE that decides the level (DECISIONS.md D51; manuscript Objective 3c, Scope,
// Gantt 5.3). The level is NOT chosen by Gemini. It comes from this fixed, published score over the patient's own
// readings, so the same readings always give the same level and anyone can check a result by hand. Gemini is then only
// asked to explain the level and give lifestyle advice (prompts.js buildRiskPrompt), and can never change it.
//
// What the risk means depends on the diabetes type (manuscript Objective 3c):
//   Prediabetes        -> the risk of progressing to type 2 diabetes
//   Type 1 / Type 2    -> the risk of poor blood sugar control and its complications
// Readings are judged with the same classes the app shows (glucose.js, D4 and D40), by the person's diabetes type.
// Pure functions (no Firebase, no network), unit-tested in test/risk.test.js.

const { interpretGlucose, normalMaxFor } = require('./glucose')

const DAY_MS = 24 * 60 * 60 * 1000

const RISK_RULE = {
  /** Readings from the last 30 days are scored. */
  windowDays: 30,
  /** A score needs at least 5 readings in the last 14 days; with fewer the app says "not enough readings yet". */
  minReadings: 5,
  recentDays: 14,
  /** The trend compares the last 7 days with the 23 days before them. */
  trendDays: 7,
  /** A change of 10% or more in the average is "rising" (or "improving"). */
  trendChange: 0.10,
  /** Score 0-1 Low, 2-3 Moderate, 4 or more High (the most is 7). */
  moderateFrom: 2,
  highFrom: 4,
  maxScore: 7,
}

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)
const typeOf = (value) => (/^pre-?diabet(ic|es)$/i.test(String(value ?? '').trim()) ? 'Prediabetes' : String(value ?? '').trim())
const timeOf = (log) => {
  const value = log.logged_at
  const date = value && typeof value.toDate === 'function' ? value.toDate() : value
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
}

/**
 * Scores the patient's readings. `logs` are Glucose_Logs documents ({ reading_mgdl, context, logged_at }),
 * `profile` their Users document. Returns { enough: false, readings_recent, needed } when there is too little data,
 * otherwise { enough: true, level, score, max_score, factors, readings_used, window_days, diabetes_type }.
 * Each factor is { key, status, points, value }: the app turns key + status into words in the person's language.
 */
function assessRisk({ logs, profile, now = new Date() }) {
  const type = typeOf(profile.diabetes_type)
  const nowMs = now.getTime()
  const readings = logs
    .map((log) => ({ value: Number(log.reading_mgdl), context: log.context === 'after_meal' ? 'after_meal' : 'before_meal', at: timeOf(log) }))
    .filter((reading) => Number.isFinite(reading.value) && reading.at && reading.at.getTime() <= nowMs + 5 * 60 * 1000)
    .filter((reading) => nowMs - reading.at.getTime() <= RISK_RULE.windowDays * DAY_MS)
    .map((reading) => ({ ...reading, interpretation: interpretGlucose(reading.value, reading.context, type) }))

  const recent = readings.filter((reading) => nowMs - reading.at.getTime() <= RISK_RULE.recentDays * DAY_MS)
  if (recent.length < RISK_RULE.minReadings) {
    return { enough: false, readings_recent: recent.length, needed: RISK_RULE.minReadings }
  }

  const factors = []

  // 1. Time in range: the share of readings in the Normal class.
  const inRange = Math.round((readings.filter((reading) => reading.interpretation === 'normal').length / readings.length) * 100)
  factors.push(inRange >= 70
    ? { key: 'in_range', status: 'good', points: 0, value: { percent: inRange } }
    : inRange >= 50
      ? { key: 'in_range', status: 'fair', points: 1, value: { percent: inRange } }
      : { key: 'in_range', status: 'poor', points: 2, value: { percent: inRange } })

  // 2. Dangerous readings: any critical reading, or repeated lows.
  const critical = readings.filter((reading) => reading.interpretation === 'critical').length
  const low = readings.filter((reading) => reading.interpretation === 'low').length
  factors.push(critical > 0
    ? { key: 'dangerous', status: 'critical', points: 2, value: { critical, low } }
    : low >= 2
      ? { key: 'dangerous', status: 'some_lows', points: 1, value: { critical, low } }
      : { key: 'dangerous', status: 'none', points: 0, value: { critical, low } })

  // 3. Average: before-meal readings against the top of this person's Normal range (after-meal if there are none).
  const before = readings.filter((reading) => reading.context === 'before_meal')
  const context = before.length ? 'before_meal' : 'after_meal'
  const pool = before.length ? before : readings
  const mean = Math.round(average(pool.map((reading) => reading.value)))
  const limit = normalMaxFor(context, type)
  factors.push(mean > limit
    ? { key: 'average', status: 'above', points: 1, value: { mgdl: mean, limit, context } }
    : { key: 'average', status: 'within', points: 0, value: { mgdl: mean, limit, context } })

  // 4. Trend: the last 7 days against the 23 days before them (both need at least 2 readings).
  const cut = nowMs - RISK_RULE.trendDays * DAY_MS
  const last = average(readings.filter((reading) => reading.at.getTime() > cut).map((reading) => reading.value))
  const earlierValues = readings.filter((reading) => reading.at.getTime() <= cut).map((reading) => reading.value)
  const lastCount = readings.filter((reading) => reading.at.getTime() > cut).length
  if (lastCount < 2 || earlierValues.length < 2) {
    factors.push({ key: 'trend', status: 'unknown', points: 0, value: { percent: null } })
  } else {
    const change = (last - average(earlierValues)) / average(earlierValues)
    const percent = Math.round(change * 100)
    factors.push(change >= RISK_RULE.trendChange
      ? { key: 'trend', status: 'rising', points: 1, value: { percent } }
      : change <= -RISK_RULE.trendChange
        ? { key: 'trend', status: 'improving', points: 0, value: { percent } }
        : { key: 'trend', status: 'stable', points: 0, value: { percent } })
  }

  // 5. Activity level from the health profile.
  const activity = String(profile.activity_level ?? '').trim()
  factors.push(activity === 'Sedentary'
    ? { key: 'activity', status: 'sedentary', points: 1, value: { level: activity } }
    : { key: 'activity', status: activity ? 'active' : 'unknown', points: 0, value: { level: activity } })

  const score = factors.reduce((sum, factor) => sum + factor.points, 0)
  const level = score >= RISK_RULE.highFrom ? 'high' : score >= RISK_RULE.moderateFrom ? 'moderate' : 'low'
  return {
    enough: true,
    level,
    score,
    max_score: RISK_RULE.maxScore,
    factors,
    readings_used: readings.length,
    window_days: RISK_RULE.windowDays,
    diabetes_type: type,
  }
}

module.exports = { RISK_RULE, assessRisk }
