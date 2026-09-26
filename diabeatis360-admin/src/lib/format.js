// Small display helpers shared by the admin pages.

/** Firestore Timestamp | Date | undefined -> Date | null */
export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return value instanceof Date ? value : null
}

export function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date
    ? date.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'
}

export function formatPeso(amount) {
  return `₱${Number(amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
