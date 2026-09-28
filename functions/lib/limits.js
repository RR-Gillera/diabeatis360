'use strict'

// Free-plan daily limits (manuscript business model, DECISIONS.md D5). Premium is unlimited.
// The mobile app shows the same numbers (src/constants/plans.ts) but ONLY the server enforces them.
const FREE_LIMITS = { ai: 2, scan: 3 }

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** Start of "today" in the Philippines (UTC+8) as a Date, so a day resets at midnight Manila time. */
function startOfManilaDay(now = new Date()) {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS)
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate()) - MANILA_OFFSET_MS)
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

/** { allowed, used, limit } for a feature ('ai' | 'scan'). limit is null for premium. */
function checkLimit({ feature, premium, usedToday }) {
  if (premium) return { allowed: true, used: usedToday, limit: null }
  const limit = FREE_LIMITS[feature]
  return { allowed: usedToday < limit, used: usedToday, limit }
}

module.exports = { FREE_LIMITS, startOfManilaDay, hasPremium, countToday, checkLimit }
