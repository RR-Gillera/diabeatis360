'use strict'
// Unit tests for the risk rule (DECISIONS.md D51). Run: npm test (in functions/)
const assert = require('node:assert/strict')
const { test } = require('node:test')

const { assessRisk, RISK_RULE } = require('../lib/risk')

const NOW = new Date('2026-11-20T12:00:00+08:00')
const daysAgo = (days, hour = 8) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000 + (hour - 12) * 60 * 60 * 1000)
const log = (value, days, context = 'before_meal') => ({ reading_mgdl: value, context, logged_at: daysAgo(days) })
const factor = (result, key) => result.factors.find((item) => item.key === key)
const profile = (extra = {}) => ({ diabetes_type: 'Type 2', activity_level: 'Light', ...extra })

test('fewer than 5 readings in the last 14 days: not enough, no level', () => {
  const result = assessRisk({ logs: [log(110, 1), log(110, 2), log(110, 3), log(110, 4), log(110, 20)], profile: profile(), now: NOW })
  assert.deepEqual(result, { enough: false, readings_recent: 4, needed: RISK_RULE.minReadings })
})

test('readings older than 30 days or in the future are not scored', () => {
  const logs = [log(110, 1), log(110, 2), log(110, 3), log(110, 4), log(110, 5), log(300, 40), { reading_mgdl: 300, context: 'before_meal', logged_at: daysAgo(-2) }]
  const result = assessRisk({ logs, profile: profile(), now: NOW })
  assert.equal(result.readings_used, 5)
  assert.equal(factor(result, 'dangerous').status, 'none')
})

test('steady readings in range, an active person: Low (score 0)', () => {
  const logs = Array.from({ length: 12 }, (_, i) => log(105, i + 1))
  const result = assessRisk({ logs, profile: profile(), now: NOW })
  assert.equal(result.level, 'low')
  assert.equal(result.score, 0)
  assert.deepEqual(result.factors.map((item) => item.status), ['good', 'none', 'within', 'stable', 'active'])
})

test('a critical reading adds 2, mostly high readings add 2 + 1: High', () => {
  const logs = [...Array.from({ length: 6 }, (_, i) => log(180, i + 1)), log(260, 2), log(110, 3)]
  const result = assessRisk({ logs, profile: profile(), now: NOW })
  assert.equal(factor(result, 'in_range').status, 'poor') // 1 of 8 normal
  assert.equal(factor(result, 'dangerous').status, 'critical')
  assert.equal(factor(result, 'average').status, 'above')
  assert.equal(result.level, 'high')
  assert.ok(result.score >= RISK_RULE.highFrom)
})

test('two lows (not critical) count as 1; one does not', () => {
  const base = Array.from({ length: 8 }, (_, i) => log(100, i + 1))
  assert.equal(factor(assessRisk({ logs: [...base, log(65, 2)], profile: profile(), now: NOW }), 'dangerous').points, 0)
  assert.equal(factor(assessRisk({ logs: [...base, log(65, 2), log(62, 3)], profile: profile(), now: NOW }), 'dangerous').points, 1)
})

test('rising: the last 7 days average 10% or more above the 23 days before', () => {
  const logs = [...[10, 12, 15, 20].map((day) => log(100, day)), ...[1, 2, 3, 4].map((day) => log(115, day))]
  const result = assessRisk({ logs, profile: profile(), now: NOW })
  assert.equal(factor(result, 'trend').status, 'rising')
  assert.equal(factor(result, 'trend').value.percent, 15)
})

test('improving and "unknown" trends add nothing', () => {
  const improving = [...[10, 12, 15, 20].map((day) => log(140, day)), ...[1, 2, 3, 4].map((day) => log(110, day))]
  assert.equal(factor(assessRisk({ logs: improving, profile: profile(), now: NOW }), 'trend').status, 'improving')
  const recentOnly = [1, 2, 3, 4, 5].map((day) => log(110, day))
  assert.equal(factor(assessRisk({ logs: recentOnly, profile: profile(), now: NOW }), 'trend').status, 'unknown')
})

test('a sedentary profile adds 1', () => {
  const logs = Array.from({ length: 6 }, (_, i) => log(105, i + 1))
  const result = assessRisk({ logs, profile: profile({ activity_level: 'Sedentary' }), now: NOW })
  assert.equal(factor(result, 'activity').points, 1)
  assert.equal(result.level, 'low') // score 1 is still Low
})

test('prediabetes is judged by the normal ranges for people without diabetes (D40)', () => {
  const logs = Array.from({ length: 8 }, (_, i) => log(115, i + 1)) // Normal for Type 2, High for prediabetes
  const type2 = assessRisk({ logs, profile: profile(), now: NOW })
  const pre = assessRisk({ logs, profile: profile({ diabetes_type: 'Prediabetes' }), now: NOW })
  assert.equal(type2.level, 'low')
  assert.equal(factor(pre, 'in_range').status, 'poor')
  assert.equal(factor(pre, 'average').value.limit, 99)
  assert.equal(pre.level, 'moderate') // 2 (in range) + 1 (average) = 3
})

test('only after-meal readings: the average is checked against the after-meal limit', () => {
  const logs = Array.from({ length: 6 }, (_, i) => log(170, i + 1, 'after_meal'))
  const average = factor(assessRisk({ logs, profile: profile(), now: NOW }), 'average')
  assert.deepEqual(average.value, { mgdl: 170, limit: 179, context: 'after_meal' })
  assert.equal(average.status, 'within')
})

test('the score boundaries: 1 Low, 2 Moderate, 3 Moderate, 4 High', () => {
  const steady = Array.from({ length: 10 }, (_, i) => log(105, i + 1))
  const level = (logs, extra) => assessRisk({ logs, profile: profile(extra), now: NOW }).level
  assert.equal(level(steady, { activity_level: 'Sedentary' }), 'low') // 1
  const someLows = [...steady, log(65, 1), log(60, 2)]
  assert.equal(level(someLows, { activity_level: 'Sedentary' }), 'moderate') // 1 + 1
  assert.equal(RISK_RULE.maxScore, 7)
})
