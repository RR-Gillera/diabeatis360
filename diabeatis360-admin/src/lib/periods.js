import { startOfWeek } from './analytics'
import { toDate } from './format'

// Date-range helpers for the Analytics page's "Today / This Week / This Month / This Year / Custom Range" control.
// Pure functions (no Firebase), so the range maths is easy to explain.

const DAY = 24 * 60 * 60 * 1000

export const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** { start, end } (both inclusive) for a period. `custom` holds 'yyyy-mm-dd' strings; blank ones fall back to this month. */
export function rangeFor(period, custom = {}, now = new Date()) {
  if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) }
  if (period === 'week') {
    const start = startOfWeek(now)
    return { start, end: endOfDay(new Date(start.getTime() + 6 * DAY)) }
  }
  if (period === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(new Date(now.getFullYear(), 11, 31)) }
  if (period === 'custom' && custom.from && custom.to) {
    const start = new Date(`${custom.from}T00:00:00`)
    const end = new Date(`${custom.to}T23:59:59.999`)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) return { start, end }
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
}

/** The equally long range right before `range`, for "+12%" style comparisons. */
export function previousRange(range) {
  const length = range.end.getTime() - range.start.getTime() + 1
  return { start: new Date(range.start.getTime() - length), end: new Date(range.start.getTime() - 1) }
}

export const inRange = (value, range) => {
  const date = toDate(value)
  return Boolean(date) && date >= range.start && date <= range.end
}

/** Percent change from `previous` to `current`, or null when there was nothing to compare with. */
export function percentChange(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** "+12%" / "-4.5%" text for a stat card hint, or a plain fallback. */
export function changeHint(change, fallback = '') {
  if (change == null) return fallback
  return `${change >= 0 ? '+' : ''}${change}%`
}

/**
 * Splits a range into chart buckets: hours for one day, days up to ~3 months, months beyond that.
 * Returns [{ label, start, end }] with `end` exclusive.
 */
export function bucketsFor(range) {
  const days = Math.round((range.end.getTime() - range.start.getTime()) / DAY)
  const buckets = []

  if (days < 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), hour)
      buckets.push({ label: `${hour}:00`, start, end: new Date(start.getTime() + 60 * 60 * 1000) })
    }
    return buckets
  }

  if (days <= 92) {
    for (let cursor = startOfDay(range.start); cursor <= range.end; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      buckets.push({ label: cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), start: cursor, end: next })
    }
    return buckets
  }

  for (let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1); cursor <= range.end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    buckets.push({ label: cursor.toLocaleDateString('en-PH', { month: 'short', year: days > 366 ? '2-digit' : undefined }), start: cursor, end: next })
  }
  return buckets
}

/** How many of `dates` fall in each bucket: [{ label, count }]. */
export function countPerBucket(dates, buckets) {
  return buckets.map((bucket) => ({
    label: bucket.label,
    count: dates.filter((date) => date >= bucket.start && date < bucket.end).length,
  }))
}

/** Items per weekday, Monday first: [{ day: 'Mon', count }]. */
export function countPerWeekday(dates) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const counts = names.map((day) => ({ day, count: 0 }))
  dates.forEach((date) => { counts[(date.getDay() + 6) % 7].count += 1 })
  return counts
}
