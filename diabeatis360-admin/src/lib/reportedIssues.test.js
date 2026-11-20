// Unit tests for the Reported Issues page (DECISIONS.md D51). Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { flaggedAccount, issueRows, resolvedMessage } from './reportedIssues.js'

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

test('the reporter is told the reply, or a plain thank-you without one', () => {
  assert.equal(resolvedMessage('  Fixed in version 1.2.  '), 'An admin reviewed your report: Fixed in version 1.2.')
  assert.match(resolvedMessage(''), /marked it resolved/)
})
