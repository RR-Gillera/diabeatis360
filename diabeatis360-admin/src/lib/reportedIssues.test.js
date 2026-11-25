// Unit tests for the Reported Issues page (DECISIONS.md D51). Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { conversation, flaggedAccount, issueRows, replyMessage, reportStatus, resolvedMessage } from './reportedIssues.js'

const users = { p1: { full_name: 'Pat One', is_active: true }, d1: { full_name: 'Dr One (profile)' } }
const providers = { d1: { full_name: 'Dr One', is_active: false } }

test('only conduct reports flag an account, and they say which kind', () => {
  assert.equal(flaggedAccount({ category: 'app_problem' }), null)
  assert.deepEqual(flaggedAccount({ category: 'doctor_conduct', reported_user_id: 'd1' }), { id: 'd1', kind: 'doctor' })
  assert.deepEqual(flaggedAccount({ category: 'patient_conduct', reported_user_id: 'p1' }), { id: 'p1', kind: 'patient' })
})

test('rows carry names, the flagged account and whether it is still active', () => {
  const [row] = issueRows([{ id: 'r1', reporter_id: 'p1', reporter_role: 'patient', category: 'doctor_conduct', reported_user_id: 'd1', message: 'x', status: 'open' }], users, providers)
  assert.equal(row.reporterName, 'Pat One')
  assert.equal(row.categoryLabel, 'Flagged doctor')
  assert.equal(row.flagged.name, 'Dr One') // the directory name wins over the Users profile
  assert.equal(row.flagged.active, false) // read from Providers for a doctor
})

test('newest first, and a report without a server time yet comes first', () => {
  const at = (ms) => ({ toMillis: () => ms })
  const rows = issueRows([
    { id: 'old', created_at: at(1) },
    { id: 'new', created_at: at(5) },
    { id: 'pending' },
  ], users, providers)
  assert.deepEqual(rows.map((row) => row.id), ['pending', 'new', 'old'])
})

test('D59: the three statuses, and anything unknown counts as open (it never leaves the admin\'s list)', () => {
  assert.equal(reportStatus('awaiting_reporter'), 'awaiting_reporter')
  assert.equal(reportStatus('resolved'), 'resolved')
  assert.equal(reportStatus('open'), 'open')
  assert.equal(reportStatus(undefined), 'open')
  assert.equal(issueRows([{ id: 'r1', status: 'awaiting_reporter' }], users, providers)[0].status, 'awaiting_reporter')
})

test('D59: the conversation is oldest first, keeps an old single reply, and puts a reply still sending last', () => {
  const at = (ms) => ({ toMillis: () => ms })
  const row = { adminReply: 'Fixed before replies existed.', resolvedAt: at(3) }
  const thread = conversation(row, [
    { id: 'answer', sender_role: 'reporter', message: 'The Log screen.', created_at: at(2) },
    { id: 'sending', sender_role: 'admin', message: 'Thanks!' },
    { id: 'ask', sender_role: 'admin', message: 'Which screen?', created_at: at(1) },
  ])
  assert.deepEqual(thread.map((item) => item.id), ['ask', 'answer', 'admin_reply', 'sending'])
  assert.deepEqual(thread.map((item) => item.from), ['admin', 'reporter', 'admin', 'admin'])
  assert.deepEqual(conversation({ adminReply: '' }, []), [])
})

test('D59: a reply that waits for an answer says so in the notification', () => {
  assert.equal(replyMessage('  Can you tell us which screen?  '), 'An admin replied to your report and is waiting for your answer: Can you tell us which screen?')
})

test('the reporter is told the reply, or a plain thank-you without one', () => {
  assert.equal(resolvedMessage('  Fixed in version 1.2.  '), 'An admin reviewed your report: Fixed in version 1.2.')
  assert.match(resolvedMessage(''), /marked it resolved/)
})
