'use strict'

// Daily limits for the AI features (manuscript business model, DECISIONS.md D5; counters and caps D20).
// The mobile app shows the Free numbers (src/constants/plans.ts) but ONLY the server enforces any of them.
const FREE_LIMITS = { ai: 2, scan: 3 }

// "Unlimited" Premium still has a ceiling per person per day, far above normal use, so a script or a stuck loop on one
// account cannot burn the shared Gemini quota. The app keeps saying "unlimited" (fair use); the manuscript notes it.
const PREMIUM_LIMITS = { ai: 30, scan: 30 }

// All people together, per day: the free Gemini quota belongs to the whole project, so one cap protects everyone.
// 200 is a guess below a typical Flash free tier. Open https://aistudio.google.com/rate-limit, read the "requests per
// day" of the model in use, and set the Vercel variable GEMINI_DAILY_CAP to about 80% of it (docs/GO_LIVE.md).
const DEFAULT_PROJECT_DAILY_CAP = 200

function projectDailyCap(env = process.env) {
  const value = Number(env.GEMINI_DAILY_CAP)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PROJECT_DAILY_CAP
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** Start of "today" in the Philippines (UTC+8) as a Date, so a day resets at midnight Manila time. */
function startOfManilaDay(now = new Date()) {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS)
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate()) - MANILA_OFFSET_MS)
}

/** The Manila calendar day as "2026-10-16": the same day the limits reset on, used in the Usage_Counters document ids. */
function manilaDayKey(now = new Date()) {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * True while a subscription entitles the user to premium: 'active' or 'cancelled' (cancelling stops
 * the renewal, not the access already paid for) and not past its expiry.
 */
function hasPremium(subscriptions, now = new Date()) {
  return subscriptions.some((item) => {
    const expires = item.expires_at && typeof item.expires_at.toDate === 'function' ? item.expires_at.toDate() : item.expires_at
    return (item.status === 'active' || item.status === 'cancelled') && (!expires || expires.getTime() > now.getTime())
  })
}

/** How many of the given timestamps fall on today's Manila day. */
function countToday(timestamps, now = new Date()) {
  const start = startOfManilaDay(now).getTime()
  return timestamps.filter((value) => {
    const date = value && typeof value.toDate === 'function' ? value.toDate() : value
    return date && date.getTime() >= start
  }).length
}

/** The most one person may use of a feature ('ai' | 'scan') in a day, and which kind of limit it is ('free' | 'fair_use'). */
function allowanceFor(feature, premium) {
  return premium ? { limit: PREMIUM_LIMITS[feature], scope: 'fair_use' } : { limit: FREE_LIMITS[feature], scope: 'free' }
}

/** { allowed, used, limit, scope } for one person's use of a feature today. */
function checkLimit({ feature, premium, usedToday }) {
  const { limit, scope } = allowanceFor(feature, premium)
  return { allowed: usedToday < limit, used: usedToday, limit, scope }
}

module.exports = {
  FREE_LIMITS, PREMIUM_LIMITS, DEFAULT_PROJECT_DAILY_CAP,
  projectDailyCap, startOfManilaDay, manilaDayKey, hasPremium, countToday, allowanceFor, checkLimit,
}
