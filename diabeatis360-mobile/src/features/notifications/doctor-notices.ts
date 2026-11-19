// The order of the doctor's Notifications list (DECISIONS.md D28, QA DOC-009). No imports, so plain Node tests it
// (doctor-notices.test.mjs); app/doctor/notifications.tsx uses it.
//
// D28 says a critical reading is "a red 'Critical reading' card at the top". QA found it was a white card like any
// other, and once opened it sank to the bottom. Now: an unread critical reading is always first, above the booking
// requests waiting for an answer; once the doctor has opened it, it keeps its red card and takes its place by time.

export type NoticeOrder = {
  /** A patient's critical blood sugar reading (Notifications.notification_type 'glucose_alert', severity 'critical'). */
  critical?: boolean;
  unread?: boolean;
  /** A booking request still waiting for the doctor's answer. */
  pending?: boolean;
  when: Date | null;
};

/** 0: an unread critical reading. 1: anything else unread, or a request waiting for an answer. 2: the rest. */
export function noticeRank(notice: NoticeOrder): 0 | 1 | 2 {
  if (notice.critical && notice.unread) return 0;
  if (notice.unread || notice.pending) return 1;
  return 2;
}

/** Most urgent first, then the most recent. Returns a new list. */
export function sortNotices<T extends NoticeOrder>(notices: readonly T[]): T[] {
  return [...notices].sort((a, b) => noticeRank(a) - noticeRank(b) || (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
}
