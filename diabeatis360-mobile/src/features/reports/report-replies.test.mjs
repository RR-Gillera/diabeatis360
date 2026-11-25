// Unit tests for the conversation on a report (DECISIONS.md D59). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canReply, conversationFor, REPLY_MAX, replyFields, replyProblem, reportStatus, sortMyReports } from './report-form.ts';

test('the three statuses, and anything unknown counts as open', () => {
  assert.equal(reportStatus('awaiting_reporter'), 'awaiting_reporter');
  assert.equal(reportStatus('resolved'), 'resolved');
  assert.equal(reportStatus('open'), 'open');
  assert.equal(reportStatus(undefined), 'open');
});

test('the reporter can reply any time before the report is resolved, never after', () => {
  assert.equal(canReply('open'), true);
  assert.equal(canReply('awaiting_reporter'), true);
  assert.equal(canReply('resolved'), false);
});

test('a reply needs 1 to 1,000 characters, not counting spaces at the ends', () => {
  assert.equal(replyProblem('   '), 'empty');
  assert.equal(replyProblem('Yes'), null);
  assert.equal(replyProblem('x'.repeat(REPLY_MAX)), null);
  assert.equal(replyProblem('x'.repeat(REPLY_MAX + 1)), 'tooLong');
});

test('the reply is saved as the reporter, trimmed, with the fields firestore.rules expects', () => {
  assert.deepEqual(replyFields('r1', 'p1', '  The Log screen.  '), {
    report_id: 'r1', reporter_id: 'p1', sender_id: 'p1', sender_role: 'reporter', message: 'The Log screen.',
  });
});

test('a conversation is oldest first, only for its report, keeps an old single reply, and a reply still sending goes last', () => {
  const at = (ms) => new Date(ms);
  const replies = [
    { id: 'answer', reportId: 'r1', from: 'reporter', message: 'The Log screen.', createdAt: at(2000) },
    { id: 'sending', reportId: 'r1', from: 'reporter', message: 'Also Home.', createdAt: null },
    { id: 'ask', reportId: 'r1', from: 'admin', message: 'Which screen?', createdAt: at(1000) },
    { id: 'elsewhere', reportId: 'r2', from: 'admin', message: 'Another report.', createdAt: at(1500) },
  ];
  const thread = conversationFor({ id: 'r1', adminReply: 'Fixed.', resolvedAt: at(3000) }, replies);
  assert.deepEqual(thread.map((entry) => entry.id), ['ask', 'answer', 'r1-admin_reply', 'sending']);
  assert.deepEqual(conversationFor({ id: 'r3', adminReply: '', resolvedAt: null }, replies), []);
});

test('reports waiting for your answer come first, then newest first', () => {
  const at = (ms) => new Date(ms);
  const sorted = sortMyReports([
    { id: 'old', status: 'open', createdAt: at(1) },
    { id: 'waiting', status: 'awaiting_reporter', createdAt: at(0) },
    { id: 'new', status: 'resolved', createdAt: at(5) },
    { id: 'justSent', status: 'open', createdAt: null },
  ]);
  assert.deepEqual(sorted.map((report) => report.id), ['waiting', 'justSent', 'new', 'old']);
});
