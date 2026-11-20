import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'
import { resolvedMessage } from '../lib/reportedIssues'

// Reported Issues (DECISIONS.md D51; manuscript Table 31 #6). Patients and doctors file Reports from the mobile app; an
// admin answers and resolves them here. firestore.rules lets only an admin change status, admin_reply, resolved_by and
// resolved_at, and only under their own uid; what the reporter wrote can never be changed.

/** Saves the reply, marks the report resolved, and tells the reporter (an in-app notification, like guardians.js). */
export async function resolveReport(report, adminId, reply) {
  await updateDoc(doc(db, 'Reports', report.id), {
    status: 'resolved',
    admin_reply: reply.trim(),
    resolved_by: adminId,
    resolved_at: serverTimestamp(),
  })
  await addDoc(collection(db, 'Notifications'), {
    user_id: report.reporterId,
    notification_type: 'report_update',
    message: resolvedMessage(reply),
    severity: 'info',
    is_read: false,
    related_id: '',
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  })
}

/** Puts a resolved report back in the Open list (the reply stays, so the history is not lost). */
export function reopenReport(reportId) {
  return updateDoc(doc(db, 'Reports', reportId), { status: 'open' })
}
