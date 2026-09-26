'use strict'
const assert = require('node:assert/strict')
const { test } = require('node:test')

const { FREE_LIMITS, checkLimit, countToday, hasPremium, startOfManilaDay } = require('../lib/limits')

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

test('hasPremium needs an active, unexpired subscription', () => {
  const now = new Date('2026-09-26T00:00:00Z')
  const later = new Date('2026-10-26T00:00:00Z')
  const earlier = new Date('2026-08-26T00:00:00Z')
  assert.equal(hasPremium([{ status: 'active', expires_at: later }], now), true)
  assert.equal(hasPremium([{ status: 'active', expires_at: earlier }], now), false)
  assert.equal(hasPremium([{ status: 'cancelled', expires_at: later }], now), false)
  assert.equal(hasPremium([{ status: 'active', expires_at: { toDate: () => later } }], now), true)
  assert.equal(hasPremium([], now), false)
})

test('checkLimit: free users stop at the limit, premium never does', () => {
  assert.deepEqual(checkLimit({ feature: 'ai', premium: false, usedToday: 1 }), { allowed: true, used: 1, limit: 2 })
  assert.deepEqual(checkLimit({ feature: 'ai', premium: false, usedToday: 2 }), { allowed: false, used: 2, limit: 2 })
  assert.deepEqual(checkLimit({ feature: 'scan', premium: false, usedToday: 3 }), { allowed: false, used: 3, limit: 3 })
  assert.deepEqual(checkLimit({ feature: 'scan', premium: true, usedToday: 99 }), { allowed: true, used: 99, limit: null })
})
