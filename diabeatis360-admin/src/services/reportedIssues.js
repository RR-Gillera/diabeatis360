import { collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'

import { db } from '../firebase'
import { replyMessage, resolvedMessage } from '../lib/reportedIssues'

// Reported Issues (DECISIONS.md D51, D59; manuscript Table 31 #6). Patients and doctors file Reports from the mobile app;
// an admin talks with the reporter here (Report_Replies) and resolves the report. firestore.rules lets only an admin change
// status, resolved_by and resolved_at, only under their own uid, and what the reporter wrote can never be changed.
//
// Each action below is ONE batched write: the reply, the new status and the reporter's notification are saved together or
// not at all, so the reporter is never told about a reply that was not saved (or the other way round).

/** A new Report_Replies document from this admin, with the reporter copied on so the reporter's app can read it. */
function addAdminReply(batch, report, adminId, text) {
  batch.set(doc(collection(db, 'Report_Replies')), {
    report_id: report.id,
    reporter_id: report.reporterId,
    sender_id: adminId,
    sender_role: 'admin',
    message: text,
    created_at: serverTimestamp(),
  })
}

/** An in-app notification to the reporter (like guardians.js). It opens Report a problem in the app. */
function notifyReporter(batch, report, message) {
  batch.set(doc(collection(db, 'Notifications')), {
    user_id: report.reporterId,
    notification_type: 'report_update',
    message,
    severity: 'info',
    is_read: false,
    related_id: '',
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  })
}

/**
 * "Send reply" (D59): the admin answers or asks for more details WITHOUT resolving. The report moves to
 * "Waiting for reporter" until the reporter answers in the app, which puts it back in Open.
 */
export function sendReply(report, adminId, reply) {
  const text = reply.trim()
  const batch = writeBatch(db)
  addAdminReply(batch, report, adminId, text)
  batch.update(doc(db, 'Reports', report.id), { status: 'awaiting_reporter' })
  notifyReporter(batch, report, replyMessage(text))
  return batch.commit()
}

/** "Resolve and notify": closes the report. A closing message is optional; when written, it joins the conversation. */
export function resolveReport(report, adminId, reply) {
  const text = reply.trim()
  const batch = writeBatch(db)
  if (text) addAdminReply(batch, report, adminId, text)
  batch.update(doc(db, 'Reports', report.id), {
    status: 'resolved',
    resolved_by: adminId,
    resolved_at: serverTimestamp(),
  })
  notifyReporter(batch, report, resolvedMessage(text))
  return batch.commit()
}

/** Puts a resolved report back in the Open list (the conversation stays, so the history is not lost). */
export function reopenReport(reportId) {
  return updateDoc(doc(db, 'Reports', reportId), { status: 'open' })
}
