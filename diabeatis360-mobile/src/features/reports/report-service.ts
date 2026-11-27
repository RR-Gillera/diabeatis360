import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';

import { db } from '@/firebase';

import {
  conductReportId,
  isConductCategory,
  replyFields,
  reportFields,
  reportStatus,
  sortMyReports,
  type ReplyEntry,
  type ReportCategory,
  type ReportDraft,
  type ReportStatus,
} from './report-form';

// "Report a problem" (DECISIONS.md D51, D59). A report is a Reports document the reporter and admins can read. The admin
// and the reporter talk about it in Report_Replies until an admin resolves it; each admin reply sends the reporter an
// in-app notification.

export type MyReport = {
  id: string;
  category: ReportCategory;
  message: string;
  status: ReportStatus;
  /** The single reply of a report answered before D59 (new replies are in Report_Replies). */
  adminReply: string;
  createdAt: Date | null;
  resolvedAt: Date | null;
};

/** Thrown when the person already reported the other person on this booking (one conduct report each, D58). */
export class AlreadyReportedError extends Error {
  constructor() {
    super('already-reported');
    this.name = 'AlreadyReportedError';
  }
}

/**
 * Sends a report. firestore.rules checks every field again (who sent it, the category, the length, the booking).
 * A report about a person is filed under "<bookingId>_<reporterId>" (D58): that is what lets an admin open the chat of
 * that one consultation to investigate. Any other report gets an automatic id.
 */
export async function sendReport(draft: ReportDraft) {
  const fields = { ...reportFields(draft), created_at: serverTimestamp() };
  if (!isConductCategory(draft.category) || !draft.bookingId) {
    await addDoc(collection(db, 'Reports'), fields);
    return;
  }
  const id = conductReportId(draft.bookingId, draft.reporterId);
  // A second report would be a change to the first one, which only an admin may make, so say so plainly instead of
  // failing. The person can read only their own reports, hence the query on reporter_id.
  const mine = await getDocs(query(collection(db, 'Reports'), where('reporter_id', '==', draft.reporterId)));
  if (mine.docs.some((report) => report.id === id)) throw new AlreadyReportedError();
  await setDoc(doc(db, 'Reports', id), fields);
}

/**
 * The person's own reports: the ones waiting for their answer first, then newest first (sorted here, so no extra
 * Firestore index is needed).
 */
export function subscribeToMyReports(uid: string, onChange: (reports: MyReport[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(db, 'Reports'), where('reporter_id', '==', uid)),
    (snapshot) => onChange(sortMyReports(snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        category: data.category as ReportCategory,
        message: String(data.message ?? ''),
        status: reportStatus(data.status),
        adminReply: String(data.admin_reply ?? ''),
        createdAt: (data.created_at as Timestamp | undefined)?.toDate?.() ?? null,
        resolvedAt: (data.resolved_at as Timestamp | undefined)?.toDate?.() ?? null,
      };
    }))),
    (error) => onError(error),
  );
}

/**
 * Every reply on every one of the person's reports, in one listener (D59). Each reply carries the reporter's id, which is
 * what lets one `where reporter_id ==` query read them all; the screen groups them by report (conversationFor).
 */
export function subscribeToMyReplies(uid: string, onChange: (replies: ReplyEntry[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(db, 'Report_Replies'), where('reporter_id', '==', uid)),
    (snapshot) => onChange(snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        reportId: String(data.report_id ?? ''),
        from: data.sender_role === 'admin' ? 'admin' as const : 'reporter' as const,
        message: String(data.message ?? ''),
        createdAt: (data.created_at as Timestamp | undefined)?.toDate?.() ?? null,
      };
    })),
    (error) => onError(error),
  );
}

/**
 * The reporter adds to the conversation (D59), allowed until the report is resolved. When the admin was waiting for this
 * answer, the same write puts the report back in the admin's Open list, so they see there is something new to read.
 * firestore.rules checks it again: only on your own report, never on a resolved one, and that is the only status change
 * a reporter can make.
 */
export function sendReporterReply(report: Pick<MyReport, 'id' | 'status'>, uid: string, message: string) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'Report_Replies')), { ...replyFields(report.id, uid, message), created_at: serverTimestamp() });
  if (report.status === 'awaiting_reporter') batch.update(doc(db, 'Reports', report.id), { status: 'open' });
  return batch.commit();
}
