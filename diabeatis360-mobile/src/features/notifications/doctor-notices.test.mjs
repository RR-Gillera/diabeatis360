// Unit tests for the order of the doctor's Notifications list (src/features/notifications/doctor-notices.ts,
// DECISIONS.md D28, QA DOC-009). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { noticeRank, sortNotices } from './doctor-notices.ts';

const at = (hour) => new Date(2026, 10, 17, hour);

test('an unread critical reading is first, even above a newer request waiting for an answer', () => {
  const list = sortNotices([
    { id: 'request', pending: true, when: at(15) },
    { id: 'message', unread: true, when: at(14) },
    { id: 'critical', critical: true, unread: true, when: at(9) },
    { id: 'old', when: at(16) },
  ]);
  assert.deepEqual(list.map((notice) => notice.id), ['critical', 'request', 'message', 'old']);
});

test('once opened, a critical reading takes its place by time (it keeps its red card on screen)', () => {
  assert.equal(noticeRank({ critical: true, unread: false, when: at(9) }), 2);
  const list = sortNotices([{ id: 'readCritical', critical: true, when: at(9) }, { id: 'newer', when: at(10) }]);
  assert.deepEqual(list.map((notice) => notice.id), ['newer', 'readCritical']);
});

test('two unread critical readings: the newest first; a notice with no time goes last in its group', () => {
  const list = sortNotices([
    { id: 'early', critical: true, unread: true, when: at(8) },
    { id: 'late', critical: true, unread: true, when: at(11) },
    { id: 'noTime', critical: true, unread: true, when: null },
  ]);
  assert.deepEqual(list.map((notice) => notice.id), ['late', 'early', 'noTime']);
});
