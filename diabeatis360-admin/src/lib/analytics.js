import { toDate } from './format'
import { bookingStatusLabels, commissionOf } from './labels'

// Pure functions that turn raw Firestore documents into chart data. No Firebase imports, so they are easy to test.

const DAY = 24 * 60 * 60 * 1000

/** Monday 00:00 of the week containing `date`. */
export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** The last `count` weeks, oldest first: [{ start, label }]. */
export function lastWeeks(count, now = new Date()) {
  const thisWeek = startOfWeek(now)
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(thisWeek.getTime() - (count - 1 - index) * 7 * DAY)
    return { start, label: start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) }
  })
}

function bucketIndex(weeks, date) {
  if (!date) return -1
  const first = weeks[0].start.getTime()
  const index = Math.floor((date.getTime() - first) / (7 * DAY))
  return index >= 0 && index < weeks.length ? index : -1
}

/** New accounts per week (Users.created_at). */
export function signupsByWeek(users, weeks) {
  const counts = weeks.map((week) => ({ week: week.label, patients: 0, doctors: 0 }))
  users.forEach((user) => {
    const index = bucketIndex(weeks, toDate(user.created_at))
    if (index >= 0) counts[index][user.role === 'doctor' ? 'doctors' : 'patients'] += 1
  })
  return counts
}

/** Platform commission from COMPLETED consultations, per week of the appointment. */
export function revenueByWeek(bookings, weeks) {
  const totals = weeks.map((week) => ({ week: week.label, revenue: 0 }))
  bookings.filter((booking) => booking.status === 'completed').forEach((booking) => {
    const index = bucketIndex(weeks, toDate(booking.scheduled_at))
    if (index >= 0) totals[index].revenue = Math.round((totals[index].revenue + commissionOf(booking)) * 100) / 100
  })
  return totals
}

/** How many bookings are in each status: [{ status, label, count }]. Statuses with none are kept so the chart is stable. */
export function bookingsByStatus(bookings) {
  return Object.keys(bookingStatusLabels).map((status) => ({
    status,
    label: bookingStatusLabels[status],
    count: bookings.filter((booking) => booking.status === status).length,
  }))
}

/** Average glucose (mg/dL) per day for the last `days` days; days without readings have average null. */
export function glucoseByDay(logs, days, now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: days }, (_, index) => {
    const day = new Date(today.getTime() - (days - 1 - index) * DAY)
    return { day: day.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), start: day.getTime(), sum: 0, count: 0 }
  })
  logs.forEach((log) => {
    const when = toDate(log.logged_at)
    if (!when) return
    const bucket = buckets.find((item) => when.getTime() >= item.start && when.getTime() < item.start + DAY)
    if (bucket) {
      bucket.sum += Number(log.reading_mgdl ?? 0)
      bucket.count += 1
    }
  })
  return buckets.map((bucket) => ({ day: bucket.day, average: bucket.count ? Math.round(bucket.sum / bucket.count) : null }))
}

/** Overall glucose numbers for the summary cards. */
export function glucoseSummary(logs) {
  const values = logs.map((log) => Number(log.reading_mgdl)).filter((value) => Number.isFinite(value))
  return {
    count: values.length,
    average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
  }
}
