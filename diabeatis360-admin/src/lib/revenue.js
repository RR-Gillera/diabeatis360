import { toDate } from './format'
import { commissionOf } from './labels'

// Pure functions behind the Revenue page (no Firebase imports, so they are easy to explain and test).
//
// What "platform revenue" means in Diabeatis360 (DECISIONS.md D3 + D5):
//   1. the 15% commission on COMPLETED consultations, and
//   2. what patients pay for a premium plan (the plan's price, counted once when the subscription starts).
// Doctors keep the other 85% of each consultation fee, so that part is never platform revenue.
// Payments are mocked in the app (no real billing yet), so these are recorded amounts, not bank deposits.

/** One list of dated money events: [{ date, amount, kind: 'consultation' | 'subscription' }]. */
export function revenueEvents(bookings, subscriptions, plans) {
  const priceByPlan = Object.fromEntries(plans.map((plan) => [plan.id, Number(plan.price ?? 0)]))
  const events = []
  bookings.filter((booking) => booking.status === 'completed').forEach((booking) => {
    const date = toDate(booking.scheduled_at)
    if (date) events.push({ date, amount: commissionOf(booking), kind: 'consultation' })
  })
  subscriptions.forEach((subscription) => {
    const date = toDate(subscription.started_at)
    const price = priceByPlan[subscription.plan_id] ?? 0
    if (date && price > 0) events.push({ date, amount: price, kind: 'subscription' })
  })
  return events
}

const round2 = (value) => Math.round(value * 100) / 100
const sum = (events) => round2(events.reduce((total, event) => total + event.amount, 0))

/** Headline numbers for the four stat cards. */
export function revenueTotals(events, bookings, now = new Date()) {
  const thisMonth = events.filter((event) => event.date.getFullYear() === now.getFullYear() && event.date.getMonth() === now.getMonth())
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = events.filter((event) => event.date.getFullYear() === previous.getFullYear() && event.date.getMonth() === previous.getMonth())

  const total = sum(events)
  const consultation = sum(events.filter((event) => event.kind === 'consultation'))
  const thisMonthTotal = sum(thisMonth)
  const lastMonthTotal = sum(lastMonth)

  // Money the patient still has to pay on accepted/finished consultations (fee, not commission).
  const unpaid = bookings.filter((booking) => booking.payment_status === 'unpaid' && ['confirmed', 'completed'].includes(booking.status))

  return {
    total,
    thisMonth: thisMonthTotal,
    monthChange: lastMonthTotal > 0 ? round2(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null,
    consultation,
    consultationShare: total > 0 ? Math.round((consultation / total) * 100) : 0,
    pendingAmount: round2(unpaid.reduce((amount, booking) => amount + Number(booking.fee ?? 0), 0)),
    pendingCount: unpaid.length,
  }
}

/** Revenue per period for the growth chart: last 12 months, or last 8 quarters. */
export function revenueByPeriod(events, mode, now = new Date()) {
  if (mode === 'quarterly') {
    const currentQuarter = Math.floor(now.getMonth() / 3)
    const buckets = Array.from({ length: 8 }, (_, index) => {
      const offset = 7 - index
      const quarterIndex = now.getFullYear() * 4 + currentQuarter - offset
      return { year: Math.floor(quarterIndex / 4), quarter: quarterIndex % 4, revenue: 0 }
    })
    events.forEach((event) => {
      const bucket = buckets.find((item) => item.year === event.date.getFullYear() && item.quarter === Math.floor(event.date.getMonth() / 3))
      if (bucket) bucket.revenue = round2(bucket.revenue + event.amount)
    })
    return buckets.map((bucket) => ({ label: `Q${bucket.quarter + 1} '${String(bucket.year).slice(2)}`, revenue: bucket.revenue }))
  }

  const buckets = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
    return { year: start.getFullYear(), month: start.getMonth(), label: start.toLocaleDateString('en-PH', { month: 'short' }), revenue: 0 }
  })
  events.forEach((event) => {
    const bucket = buckets.find((item) => item.year === event.date.getFullYear() && item.month === event.date.getMonth())
    if (bucket) bucket.revenue = round2(bucket.revenue + event.amount)
  })
  return buckets.map(({ label, revenue }) => ({ label, revenue }))
}
