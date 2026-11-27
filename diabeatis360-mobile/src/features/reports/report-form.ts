// "Report a problem" (DECISIONS.md D51; manuscript Table 31 #6 "Admin can handle reported issues or flagged accounts").
// The rules for a report, kept in one file with no app imports so plain Node tests them (report-form.test.mjs).
// firestore.rules checks the same things again, so a modified app cannot get around them.

/** What a report is about. The two "conduct" kinds flag the other person on a booking; the rest name nobody. */
export const REPORT_CATEGORIES = ['app_problem', 'payment', 'account', 'doctor_conduct', 'patient_conduct', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_MESSAGE_MIN = 10;
export const REPORT_MESSAGE_MAX = 1000;

export type ReporterRole = 'patient' | 'doctor';

/** The categories a person can pick from the Profile menu (a report about a person starts from a consultation instead). */
export const GENERAL_CATEGORIES: ReportCategory[] = ['app_problem', 'payment', 'account', 'other'];

/** The category used when flagging the other person on a booking: a patient reports a doctor, a doctor a patient. */
export function conductCategoryFor(role: ReporterRole): ReportCategory {
  return role === 'doctor' ? 'patient_conduct' : 'doctor_conduct';
}

export function isConductCategory(category: string) {
  return category === 'doctor_conduct' || category === 'patient_conduct';
}

export type ReportProblem = 'category' | 'tooShort' | 'tooLong' | null;

/** What is wrong with a report before it is sent, or null when it can be sent. Spaces at the ends do not count. */
export function reportProblem(category: string | null, message: string): ReportProblem {
  if (!category || !(REPORT_CATEGORIES as readonly string[]).includes(category)) return 'category';
  const length = message.trim().length;
  if (length < REPORT_MESSAGE_MIN) return 'tooShort';
  if (length > REPORT_MESSAGE_MAX) return 'tooLong';
  return null;
}

// ---- The conversation on a report (DECISIONS.md D59): the admin can ask for more details before resolving it.

/**
 * `open`: the admin's turn. `awaiting_reporter`: the admin asked you something and is waiting for your answer.
 * `resolved`: closed. Anything else counts as open.
 */
export type ReportStatus = 'open' | 'awaiting_reporter' | 'resolved';

export function reportStatus(value: unknown): ReportStatus {
  return value === 'resolved' || value === 'awaiting_reporter' ? value : 'open';
}

export const REPLY_MAX = 1000;

/** The reporter may add to the conversation at any time until the report is resolved (team decision, D59). */
export function canReply(status: ReportStatus) {
  return status !== 'resolved';
}

export type ReplyProblem = 'empty' | 'tooLong' | null;

/** What is wrong with a reply before it is sent, or null. Spaces at the ends do not count. */
export function replyProblem(message: string): ReplyProblem {
  const length = message.trim().length;
  if (length === 0) return 'empty';
  if (length > REPLY_MAX) return 'tooLong';
  return null;
}

/** The fields of the reporter's Report_Replies document, without `created_at` (the service adds the server's time). */
export function replyFields(reportId: string, reporterId: string, message: string) {
  return {
    report_id: reportId,
    reporter_id: reporterId,
    sender_id: reporterId,
    sender_role: 'reporter' as const,
    message: message.trim(),
  };
}

export type ReplyEntry = { id: string; reportId: string; from: 'admin' | 'reporter'; message: string; createdAt: Date | null };

/**
 * One report's conversation, oldest first: its replies, plus the single `admin_reply` of a report answered before D59
 * (dated when it was resolved), so an old answer still shows. A reply still sending has no server time yet: it goes last.
 */
export function conversationFor(
  report: { id: string; adminReply: string; resolvedAt: Date | null },
  replies: ReplyEntry[],
): ReplyEntry[] {
  const thread = replies.filter((reply) => reply.reportId === report.id);
  if (report.adminReply) {
    thread.push({ id: `${report.id}-admin_reply`, reportId: report.id, from: 'admin', message: report.adminReply, createdAt: report.resolvedAt });
  }
  const time = (entry: ReplyEntry) => entry.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return thread.sort((a, b) => time(a) - time(b));
}

/** "Your reports": the ones waiting for your answer first, then newest first. A report just sent counts as newest. */
export function sortMyReports<T extends { status: ReportStatus; createdAt: Date | null }>(reports: T[]): T[] {
  const waiting = (report: T) => (report.status === 'awaiting_reporter' ? 1 : 0);
  const time = (report: T) => report.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...reports].sort((a, b) => waiting(b) - waiting(a) || time(b) - time(a));
}

export type ReportDraft = {
  reporterId: string;
  reporterRole: ReporterRole;
  category: ReportCategory;
  message: string;
  /** Only for a conduct report: the other person on the booking, and the booking. */
  reportedUserId?: string;
  bookingId?: string;
};

/**
 * The fields of a new Reports document, without `created_at` (the service adds the server's time). A conduct report
 * carries the person and the booking; any other report carries neither, exactly as firestore.rules expects.
 */
export function reportFields(draft: ReportDraft) {
  const base = {
    reporter_id: draft.reporterId,
    reporter_role: draft.reporterRole,
    category: draft.category,
    message: draft.message.trim(),
    status: 'open' as const,
  };
  if (!isConductCategory(draft.category)) return base;
  return { ...base, reported_user_id: draft.reportedUserId ?? '', booking_id: draft.bookingId ?? '' };
}

/**
 * The document id of a conduct report: "<bookingId>_<reporterId>" (DECISIONS.md D58). firestore.rules forces this id, so
 * each person can report the other on a booking once, and an admin investigating it can open that booking's chat.
 */
export function conductReportId(bookingId: string, reporterId: string) {
  return `${bookingId}_${reporterId}`;
}
