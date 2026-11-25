// Unit tests for reviewing a reported consultation (DECISIONS.md D58). Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { accessLogId, accessRows, canReviewConversation, conversationLines } from './conversationReview.js'

const at = (iso) => new Date(iso)
const flagged = { id: 'd1', kind: 'doctor', name: 'Dr One' }

test('only a conduct report filed under "<bookingId>_<reporterId>" opens a consultation', () => {
  assert.equal(canReviewConversation({ id: 'b1_p1', bookingId: 'b1', reporterId: 'p1', flagged }), true)
  // A report about the app names no person and no booking.
  assert.equal(canReviewConversation({ id: 'x7Yz', bookingId: '', reporterId: 'p1', flagged: null }), false)
  // A conduct report from before D58 has an automatic id; the rules would refuse it.
  assert.equal(canReviewConversation({ id: 'aB3dE5', bookingId: 'b1', reporterId: 'p1', flagged }), false)
  assert.equal(canReviewConversation(null), false)
})

test('the access record id matches the one firestore.rules expects', () => {
  assert.equal(accessLogId('b1', 'a1'), 'b1_a1')
})

test('the chat reads in the order it was sent, with names and roles', () => {
  const lines = conversationLines([
    { id: 'm2', sender_id: 'd1', sender_role: 'doctor', message: 'Second', sent_at: at('2026-11-20T10:05:00Z') },
    { id: 'm3', sender_id: 'p1', sender_role: 'patient', message: 'Not sent yet', sent_at: null },
    { id: 'm1', sender_id: 'p1', sender_role: 'patient', message: 'First', sent_at: at('2026-11-20T10:00:00Z'), trend: [{ day: at('2026-11-19T00:00:00Z'), average_mgdl: 120 }] },
  ], { p1: 'Pat One', d1: 'Dr One' })
  assert.deepEqual(lines.map((line) => line.id), ['m1', 'm2', 'm3'])
  assert.equal(lines[0].who, 'Pat One')
  assert.equal(lines[1].role, 'Doctor')
  assert.equal(lines[0].sharedTrend, true)
  assert.equal(lines[1].sharedTrend, false)
})

test('a sender the page does not know is shown as unknown, not as a blank', () => {
  const [line] = conversationLines([{ id: 'm1', sender_id: 'zz', sender_role: 'patient', message: 'Hi', sent_at: at('2026-11-20T10:00:00Z') }], {})
  assert.equal(line.who, 'Unknown account')
})

test('access records list the latest opening first', () => {
  const rows = accessRows([
    { id: 'b1_a1', admin_id: 'a1', admin_name: 'Admin One', open_count: 2, first_opened_at: at('2026-11-20T09:00:00Z'), last_opened_at: at('2026-11-21T09:00:00Z') },
    { id: 'b1_a2', admin_id: 'a2', admin_name: '', open_count: 1, first_opened_at: at('2026-11-22T09:00:00Z'), last_opened_at: at('2026-11-22T09:00:00Z') },
  ])
  assert.deepEqual(rows.map((row) => row.id), ['b1_a2', 'b1_a1'])
  assert.equal(rows[0].adminName, 'a2') // no name saved: show the admin's id
  assert.equal(rows[1].count, 2)
})
