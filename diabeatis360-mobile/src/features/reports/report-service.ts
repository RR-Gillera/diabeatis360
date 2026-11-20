import { addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';

import { reportFields, type ReportCategory, type ReportDraft } from './report-form';

// "Report a problem" (DECISIONS.md D51). A report is a Reports document the reporter and admins can read. The admin panel
// answers it (admin_reply), marks it resolved, and sends the reporter an in-app notification.

export type MyReport = {
  id: string;
  category: ReportCategory;
  message: string;
  status: 'open' | 'resolved';
  adminReply: string;
  createdAt: Date | null;
};

/** Sends a report. firestore.rules checks every field again (who sent it, the category, the length, the booking). */
export async function sendReport(draft: ReportDraft) {
  await addDoc(collection(db, 'Reports'), { ...reportFields(draft), created_at: serverTimestamp() });
}

/** The person's own reports, newest first (sorted here, so no extra Firestore index is needed). */
export function subscribeToMyReports(uid: string, onChange: (reports: MyReport[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(db, 'Reports'), where('reporter_id', '==', uid)),
    (snapshot) => onChange(snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          category: data.category as ReportCategory,
          message: String(data.message ?? ''),
          status: data.status === 'resolved' ? 'resolved' as const : 'open' as const,
          adminReply: String(data.admin_reply ?? ''),
          createdAt: (data.created_at as Timestamp | undefined)?.toDate?.() ?? null,
        };
      })
      .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now()))),
    (error) => onError(error),
  );
}
