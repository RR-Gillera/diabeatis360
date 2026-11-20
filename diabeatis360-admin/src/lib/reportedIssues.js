// "Reported Issues" (DECISIONS.md D51; manuscript Table 31 #6 "Admin can handle reported issues or flagged accounts").
// Labels and the row shape for the admin list. No Firebase imports, so `npm test` checks it (reportedIssues.test.js).

export const reportCategoryLabels = {
  app_problem: 'Problem with the app',
  payment: 'Payment',
  account: 'Account',
  doctor_conduct: 'Flagged doctor',
  patient_conduct: 'Flagged patient',
  other: 'Other',
}

export const REPLY_MAX = 1000

/** The account a conduct report flags, and which collection holds its active/inactive switch. */
export function flaggedAccount(report) {
  if (report.category === 'doctor_conduct') return { id: report.reported_user_id || '', kind: 'doctor' }
  if (report.category === 'patient_conduct') return { id: report.reported_user_id || '', kind: 'patient' }
  return null
}

/**
 * One table row per report, joined with the people's names. `users` and `providers` are maps of id -> document.
 * A doctor's name comes from Providers (the directory name), anyone else's from Users.
 */
export function issueRows(reports, users, providers) {
  const nameOf = (id) => providers[id]?.full_name || users[id]?.full_name || 'Unknown account'
  return reports
    .map((report) => {
      const flagged = flaggedAccount(report)
      return {
        id: report.id,
        category: report.category,
        categoryLabel: reportCategoryLabels[report.category] || 'Other',
        message: String(report.message || ''),
        status: report.status === 'resolved' ? 'resolved' : 'open',
        adminReply: String(report.admin_reply || ''),
        createdAt: report.created_at,
        resolvedAt: report.resolved_at,
        reporterId: report.reporter_id,
        reporterName: nameOf(report.reporter_id),
        reporterRole: report.reporter_role === 'doctor' ? 'Doctor' : 'Patient',
        bookingId: report.booking_id || '',
        flagged: flagged
          ? {
            ...flagged,
            name: nameOf(flagged.id),
            // A doctor is switched off on Providers, a patient on Users (the same switches as the Providers and Users pages).
            active: flagged.kind === 'doctor' ? providers[flagged.id]?.is_active !== false : users[flagged.id]?.is_active !== false,
          }
          : null,
      }
    })
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
}

function millis(value) {
  if (!value) return Number.MAX_SAFE_INTEGER // a report just sent has no server time yet: show it first
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

/** The in-app notification text the reporter receives when an admin resolves their report. */
export function resolvedMessage(reply) {
  const text = String(reply || '').trim()
  return text
    ? `An admin reviewed your report: ${text}`
    : 'An admin reviewed your report and marked it resolved. Thank you for telling us.'
}
