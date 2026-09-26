import { useMemo, useState } from 'react'

import DataTable, { Tabs } from '../components/DataTable'
import { Card, Notice, PageHeader, StatusBadge } from '../components/ui'
import { formatDateTime, formatPeso, toDate } from '../lib/format'
import { bookingStatusLabels, bookingStatusTone, commissionOf, paymentStatusLabels } from '../lib/labels'
import { useCollection } from '../lib/useCollection'

const statusTabs = ['all', 'pending', 'confirmed', 'completed', 'declined', 'cancelled']

// View Appointment History (module 6, admin): every booking on the platform, with the platform's revenue.
// Revenue = the 15% commission (DECISIONS.md D3) on COMPLETED consultations.
export default function AppointmentsPage() {
  const bookings = useCollection('Bookings')
  const users = useCollection('Users')
  const doctors = useCollection('Providers')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const names = useMemo(() => ({
    patients: Object.fromEntries(users.data.map((user) => [user.id, user.full_name || user.email || user.id])),
    doctors: Object.fromEntries(doctors.data.map((doctor) => [doctor.id, doctor.full_name || doctor.id])),
  }), [users.data, doctors.data])

  const rows = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : null
    const end = to ? new Date(`${to}T23:59:59`) : null
    return bookings.data
      .filter((booking) => status === 'all' || booking.status === status)
      .filter((booking) => {
        const when = toDate(booking.scheduled_at)
        if (!when) return !start && !end
        return (!start || when >= start) && (!end || when <= end)
      })
      .sort((a, b) => (toDate(b.scheduled_at)?.getTime() ?? 0) - (toDate(a.scheduled_at)?.getTime() ?? 0))
  }, [bookings.data, status, from, to])

  const completed = rows.filter((booking) => booking.status === 'completed')
  const totals = {
    count: rows.length,
    fees: completed.reduce((sum, booking) => sum + Number(booking.fee ?? 0), 0),
    revenue: completed.reduce((sum, booking) => sum + commissionOf(booking), 0),
  }

  const columns = [
    { key: 'when', header: 'Date & time', render: (b) => formatDateTime(b.scheduled_at) },
    { key: 'patient', header: 'Patient', render: (b) => names.patients[b.patient_id] ?? b.patient_id },
    { key: 'doctor', header: 'Doctor', render: (b) => names.doctors[b.provider_id] ?? b.provider_id },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge tone={bookingStatusTone[b.status] ?? 'neutral'}>{bookingStatusLabels[b.status] ?? b.status}</StatusBadge> },
    { key: 'payment', header: 'Payment', render: (b) => paymentStatusLabels[b.payment_status] ?? b.payment_status ?? '—' },
    { key: 'fee', header: 'Fee', align: 'right', render: (b) => formatPeso(b.fee) },
    { key: 'commission', header: 'Commission (15%)', align: 'right', render: (b) => formatPeso(commissionOf(b)) },
  ]

  const error = bookings.error || users.error || doctors.error

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Every booking on the platform, with revenue from completed consultations." />
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-bold uppercase text-muted">Bookings shown</p><p className="mt-1 text-3xl font-extrabold">{totals.count}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">Consultation fees (completed)</p><p className="mt-1 text-3xl font-extrabold">{formatPeso(totals.fees)}</p></Card>
        <Card><p className="text-xs font-bold uppercase text-muted">Platform revenue (15%)</p><p className="mt-1 text-3xl font-extrabold text-brand">{formatPeso(totals.revenue)}</p></Card>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={status}
          onChange={setStatus}
          options={statusTabs.map((value) => ({
            value,
            label: value === 'all' ? 'All' : bookingStatusLabels[value],
            count: value === 'all' ? bookings.data.length : bookings.data.filter((booking) => booking.status === value).length,
          }))}
        />
        <div className="mb-4 flex items-center gap-2 text-sm">
          <label className="text-muted">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded-xl border border-gray-200 bg-white px-3 py-2" /></label>
          <label className="text-muted">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded-xl border border-gray-200 bg-white px-3 py-2" /></label>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} empty="No bookings match these filters." />
    </div>
  )
}
