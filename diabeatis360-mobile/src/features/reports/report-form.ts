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
