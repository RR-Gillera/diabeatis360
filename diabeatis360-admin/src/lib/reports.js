import { formatDateTime, toDate } from './format'
import { bookingStatusLabels, commissionOf, paymentStatusLabels } from './labels'

// Report definitions for "Generate System Reports". Each report turns the collections into rows; the page shows
// the rows as a table, and the very same rows become the CSV file.

const inRange = (value, from, to) => {
  const date = toDate(value)
  if (!date) return !from && !to
  return (!from || date >= from) && (!to || date <= to)
}

export const reportTypes = [
  { value: 'users', label: 'Users', description: 'Every patient and doctor account.' },
  { value: 'bookings', label: 'Appointments & revenue', description: 'Bookings with fees and platform commission.' },
  { value: 'health', label: 'Blood sugar trends', description: 'Per patient: readings, average, lowest and highest.' },
]

export function buildReport(type, data, from, to) {
  const usersById = Object.fromEntries(data.users.map((user) => [user.id, user]))
  const doctorsById = Object.fromEntries(data.providers.map((doctor) => [doctor.id, doctor]))

  if (type === 'users') {
    const rows = data.users
      .filter((user) => inRange(user.created_at, from, to))
      .sort((a, b) => String(a.full_name ?? '').localeCompare(String(b.full_name ?? '')))
    return {
      title: 'Users report',
      rows,
      columns: [
        { header: 'Name', value: (u) => u.full_name ?? '' },
        { header: 'Email', value: (u) => u.email ?? '' },
        { header: 'Role', value: (u) => (u.role === 'doctor' ? 'Doctor' : 'Patient') },
        { header: 'Diabetes type', value: (u) => u.diabetes_type ?? '' },
        { header: 'Joined', value: (u) => formatDateTime(u.created_at) },
        { header: 'Status', value: (u) => (u.is_active === false ? 'Inactive' : 'Active') },
      ],
    }
  }

  if (type === 'bookings') {
    const rows = data.bookings
      .filter((booking) => inRange(booking.scheduled_at, from, to))
      .sort((a, b) => (toDate(b.scheduled_at)?.getTime() ?? 0) - (toDate(a.scheduled_at)?.getTime() ?? 0))
    return {
      title: 'Appointments & revenue report',
      rows,
      columns: [
        { header: 'Date & time', value: (b) => formatDateTime(b.scheduled_at) },
        { header: 'Patient', value: (b) => usersById[b.patient_id]?.full_name ?? b.patient_id },
        { header: 'Doctor', value: (b) => doctorsById[b.provider_id]?.full_name ?? b.provider_id },
        { header: 'Status', value: (b) => bookingStatusLabels[b.status] ?? b.status },
        { header: 'Payment', value: (b) => paymentStatusLabels[b.payment_status] ?? b.payment_status ?? '' },
        { header: 'Fee (PHP)', value: (b) => Number(b.fee ?? 0).toFixed(2) },
        { header: 'Commission 15% (PHP)', value: (b) => commissionOf(b).toFixed(2) },
      ],
    }
  }

  // Blood sugar trends: one row per patient who logged readings in the range.
  const perPatient = new Map()
  data.glucose
    .filter((log) => inRange(log.logged_at, from, to))
    .forEach((log) => {
      const value = Number(log.reading_mgdl)
      if (!Number.isFinite(value)) return
      const entry = perPatient.get(log.patient_id) ?? { patientId: log.patient_id, values: [] }
      entry.values.push(value)
      perPatient.set(log.patient_id, entry)
    })
  const rows = [...perPatient.values()]
    .map((entry) => ({
      ...entry,
      name: usersById[entry.patientId]?.full_name ?? entry.patientId,
      type: usersById[entry.patientId]?.diabetes_type ?? '',
      average: Math.round(entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length),
      lowest: Math.min(...entry.values),
      highest: Math.max(...entry.values),
    }))
    .sort((a, b) => b.average - a.average)
  return {
    title: 'Blood sugar trends report',
    rows,
    columns: [
      { header: 'Patient', value: (r) => r.name },
      { header: 'Diabetes type', value: (r) => r.type },
      { header: 'Readings', value: (r) => r.values.length },
      { header: 'Average (mg/dL)', value: (r) => r.average },
      { header: 'Lowest (mg/dL)', value: (r) => r.lowest },
      { header: 'Highest (mg/dL)', value: (r) => r.highest },
    ],
  }
}
