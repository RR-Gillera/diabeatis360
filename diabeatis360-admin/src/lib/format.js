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

/** Age in whole years from a birthdate, or null if there isn't one — used on GuardiansPage to show the child's age. */
export function ageFrom(birthdateValue) {
  const birthdate = toDate(birthdateValue)
  if (!birthdate) return null
  const now = new Date()
  let age = now.getFullYear() - birthdate.getFullYear()
  const hadBirthdayThisYear = now.getMonth() > birthdate.getMonth()
    || (now.getMonth() === birthdate.getMonth() && now.getDate() >= birthdate.getDate())
  if (!hadBirthdayThisYear) age -= 1
  return age
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago" — used by the Overview activity feed. */
export function timeAgo(value, now = new Date()) {
  const date = toDate(value)
  if (!date) return ''
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : formatDate(date)
}
