'use strict'
const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  DEFAULT_PROJECT_DAILY_CAP, FREE_LIMITS, PREMIUM_LIMITS, allowanceFor, checkLimit, countToday, hasPremium, manilaDayKey, projectDailyCap, startOfManilaDay,
} = require('../lib/limits')

test('free limits match the manuscript: 2 AI generations and 3 scans a day', () => {
  assert.deepEqual(FREE_LIMITS, { ai: 2, scan: 3 })
})

test('a day starts at midnight Manila time (UTC+8)', () => {
  // 26 Sep 2026 20:00 UTC is 27 Sep 04:00 in Manila, so the day started 27 Sep 00:00 Manila = 26 Sep 16:00 UTC
  assert.equal(startOfManilaDay(new Date('2026-09-26T20:00:00Z')).toISOString(), '2026-09-26T16:00:00.000Z')
  // 26 Sep 2026 10:00 UTC is 26 Sep 18:00 in Manila
  assert.equal(startOfManilaDay(new Date('2026-09-26T10:00:00Z')).toISOString(), '2026-09-25T16:00:00.000Z')
})

test('countToday only counts timestamps from the current Manila day', () => {
  const now = new Date('2026-09-26T10:00:00Z') // 18:00 Manila
  const stamps = [
    new Date('2026-09-26T02:00:00Z'), // 10:00 today Manila
    new Date('2026-09-25T17:00:00Z'), // 01:00 today Manila
    new Date('2026-09-25T15:00:00Z'), // 23:00 YESTERDAY Manila
    null,
    { toDate: () => new Date('2026-09-26T09:00:00Z') },
  ]
  assert.equal(countToday(stamps, now), 3)
})

test('hasPremium needs an unexpired subscription that is active or cancelled-but-not-yet-lapsed', () => {
  const now = new Date('2026-09-26T00:00:00Z')
  const later = new Date('2026-10-26T00:00:00Z')
  const earlier = new Date('2026-08-26T00:00:00Z')
  assert.equal(hasPremium([{ status: 'active', expires_at: later }], now), true)
  assert.equal(hasPremium([{ status: 'active', expires_at: earlier }], now), false)
  // Cancelling stops the renewal, not access already paid for: still premium until expiry.
  assert.equal(hasPremium([{ status: 'cancelled', expires_at: later }], now), true)
  assert.equal(hasPremium([{ status: 'cancelled', expires_at: earlier }], now), false)
  assert.equal(hasPremium([{ status: 'active', expires_at: { toDate: () => later } }], now), true)
  assert.equal(hasPremium([], now), false)
})

test('checkLimit: free users stop at the free limit, premium at the fair-use ceiling', () => {
  assert.deepEqual(checkLimit({ feature: 'ai', premium: false, usedToday: 1 }), { allowed: true, used: 1, limit: 2, scope: 'free' })
  assert.deepEqual(checkLimit({ feature: 'ai', premium: false, usedToday: 2 }), { allowed: false, used: 2, limit: 2, scope: 'free' })
  assert.deepEqual(checkLimit({ feature: 'scan', premium: false, usedToday: 3 }), { allowed: false, used: 3, limit: 3, scope: 'free' })
  assert.deepEqual(checkLimit({ feature: 'scan', premium: true, usedToday: 29 }), { allowed: true, used: 29, limit: 30, scope: 'fair_use' })
  assert.deepEqual(checkLimit({ feature: 'scan', premium: true, usedToday: 30 }), { allowed: false, used: 30, limit: 30, scope: 'fair_use' })
})

test('premium is "unlimited" in the app but has a fair-use ceiling far above normal use (D20)', () => {
  assert.deepEqual(PREMIUM_LIMITS, { ai: 30, scan: 30 })
  assert.ok(PREMIUM_LIMITS.ai > FREE_LIMITS.ai * 5 && PREMIUM_LIMITS.scan > FREE_LIMITS.scan * 5)
  assert.deepEqual(allowanceFor('ai', false), { limit: 2, scope: 'free' })
  assert.deepEqual(allowanceFor('ai', true), { limit: 30, scope: 'fair_use' })
})

test('the project-wide daily cap defaults to 200 and can be set with GEMINI_DAILY_CAP', () => {
  assert.equal(DEFAULT_PROJECT_DAILY_CAP, 200)
  assert.equal(projectDailyCap({}), 200)
  assert.equal(projectDailyCap({ GEMINI_DAILY_CAP: '120' }), 120)
  // A typo must never switch the cap off or make it negative: anything that is not a positive whole number is ignored.
  for (const bad of ['', 'abc', '0', '-5', '12.5', 'Infinity']) assert.equal(projectDailyCap({ GEMINI_DAILY_CAP: bad }), 200, bad)
})

test('manilaDayKey is the Manila calendar day, so counters reset at midnight Manila time', () => {
  assert.equal(manilaDayKey(new Date('2026-09-26T20:00:00Z')), '2026-09-27') // 04:00 on the 27th in Manila
  assert.equal(manilaDayKey(new Date('2026-09-26T15:59:59Z')), '2026-09-26') // 23:59:59 on the 26th in Manila
  assert.equal(manilaDayKey(new Date('2026-09-26T16:00:00Z')), '2026-09-27') // exactly midnight in Manila
})
