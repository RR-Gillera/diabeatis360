import { toDate } from './format'

// Builds the Overview "Recent Activity Feed" from timestamps the app already stores — there is no separate audit-log
// collection. Each event is { id, at, name, text, tag, tone }; `name` is shown in bold before `text`.
// Coverage: new patients, doctors who applied, doctors who were verified, bookings, premium subscriptions and
// guardian ID submissions.
export function buildActivityFeed({ users, providers, bookings, subscriptions, plans, guardians }) {
  const userName = Object.fromEntries(users.map((user) => [user.id, user.full_name || 'A user']))
  const doctorName = Object.fromEntries(providers.map((doctor) => [doctor.id, doctor.full_name || 'A doctor']))
  const planName = Object.fromEntries(plans.map((plan) => [plan.id, plan.plan_name]))
  const events = []

  users.filter((user) => user.role === 'patient').forEach((user) => {
    events.push({ id: `u-${user.id}`, at: toDate(user.created_at), name: user.full_name || 'A user', text: ' registered as a new patient.', tag: 'New User', tone: 'success' })
  })
  providers.forEach((doctor) => {
    const name = doctor.full_name || 'A doctor'
    events.push(doctor.created_by_admin
      ? { id: `d-${doctor.id}`, at: toDate(doctor.created_at), name, text: ' was added as a provider by an admin.', tag: 'Provider', tone: 'purple' }
      : { id: `d-${doctor.id}`, at: toDate(doctor.created_at), name, text: ' submitted credentials for verification.', tag: 'Verification', tone: 'info' })
    if (doctor.is_verified && doctor.reviewed_at) {
      events.push({ id: `v-${doctor.id}`, at: toDate(doctor.reviewed_at), name, text: "'s verification was approved.", tag: 'Verified Doctor', tone: 'purple' })
    }
  })
  bookings.forEach((booking) => {
    events.push({
      id: `b-${booking.id}`,
      at: toDate(booking.created_at),
      name: userName[booking.patient_id] ?? 'A patient',
      text: ` booked a consultation with ${doctorName[booking.provider_id] ?? 'a doctor'}.`,
      tag: 'Booking',
      tone: 'success',
    })
  })
  subscriptions.forEach((subscription) => {
    events.push({
      id: `s-${subscription.id}`,
      at: toDate(subscription.started_at),
      name: userName[subscription.user_id] ?? 'A patient',
      text: ` subscribed to ${planName[subscription.plan_id] ?? 'a plan'}.`,
      tag: 'Payment',
      tone: 'success',
    })
  })
  guardians.forEach((entry) => {
    events.push({ id: `g-${entry.id}`, at: toDate(entry.submitted_at), name: userName[entry.id] ?? 'A pediatric account', text: ' submitted a guardian ID for review.', tag: 'Guardian', tone: 'warning' })
  })

  return events.filter((event) => event.at).sort((a, b) => b.at.getTime() - a.at.getTime())
}
