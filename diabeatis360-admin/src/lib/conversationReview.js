// Reviewing a reported consultation (DECISIONS.md D58). When the patient or the doctor on a booking reports the other,
// the admin may open THAT booking's chat and the doctor's notes to investigate, and every opening is recorded in
// Admin_Access_Log. No Firebase imports, so `npm test` checks it (conversationReview.test.js).

import { toDate } from './format.js'

/**
 * True when the admin can open this report's consultation: a conduct report filed under "<bookingId>_<reporterId>",
 * the id firestore.rules gives every conduct report since D58. (A conduct report sent before D58 has an automatic id,
 * so the rules would refuse the opening; the page says so instead of failing.)
 */
export function canReviewConversation(report) {
  return Boolean(report?.flagged && report.bookingId && report.id === `${report.bookingId}_${report.reporterId}`)
}

/** The Admin_Access_Log id of one admin opening one booking (the same shape firestore.rules expects). */
export function accessLogId(bookingId, adminId) {
  return `${bookingId}_${adminId}`
}

/**
 * The chat in the order it was sent, each line labelled with who wrote it. `names` maps a person's id to their name.
 * A message that has no server time yet (just sent) goes last. A shared blood sugar chart is described in words.
 */
export function conversationLines(messages, names) {
  return [...messages]
    .sort((a, b) => millis(a.sent_at) - millis(b.sent_at))
    .map((message) => ({
      id: message.id,
      who: names[message.sender_id] || 'Unknown account',
      role: message.sender_role === 'doctor' ? 'Doctor' : 'Patient',
      text: String(message.message || ''),
      sentAt: message.sent_at,
      sharedTrend: Array.isArray(message.trend) && message.trend.length > 0,
    }))
}

/** The access records of one booking, most recent opening first. */
export function accessRows(logs) {
  return [...logs]
    .sort((a, b) => millis(b.last_opened_at) - millis(a.last_opened_at))
    .map((log) => ({
      id: log.id,
      adminName: log.admin_name || log.admin_id,
      count: Number(log.open_count) || 0,
      firstOpenedAt: log.first_opened_at,
      lastOpenedAt: log.last_opened_at,
    }))
}

function millis(value) {
  const date = toDate(value)
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER
}
