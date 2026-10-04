import { useMemo, useState } from 'react'

import DataTable from '../../components/DataTable'
import { CheckCircleIcon, DownloadIcon } from '../../components/icons'
import { Button, Modal, SearchInput, SelectField, StatusBadge } from '../../components/ui'
import { toCsv, downloadCsv } from '../../lib/csv'
import { formatDate, formatDateTime, formatPeso, toDate } from '../../lib/format'
import { bookingStatusLabels, commissionOf, paymentStatusLabels } from '../../lib/labels'
import { printReceipt } from '../../lib/receipt'

// Payment status as the admin sees it. The app only records unpaid / paid / onsite (payment is mocked), so the
// Figma "Failed" and "Refunded" chips do not exist in our data. A declined or cancelled booking shows as such instead.
const paymentTone = { paid: 'success', unpaid: 'warning', onsite: 'neutral' }

function statusOf(booking) {
  if (['declined', 'cancelled'].includes(booking.status)) return { label: bookingStatusLabels[booking.status], tone: 'danger' }
  return { label: paymentStatusLabels[booking.payment_status] ?? 'Unpaid', tone: paymentTone[booking.payment_status] ?? 'warning' }
}

// "Consultation Payments" table + Payment Details modal (FIGMA/ADMIN Revenue, Revenue-1).
export default function PaymentsTab({ bookings, users, providers }) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')

  const rows = useMemo(() => {
    const patientNames = Object.fromEntries(users.map((user) => [user.id, user.full_name || user.email || user.id]))
    const doctorNames = Object.fromEntries(providers.map((doctor) => [doctor.id, doctor.full_name || doctor.id]))
    const start = from ? new Date(`${from}T00:00:00`) : null
    const end = to ? new Date(`${to}T23:59:59`) : null
    const needle = search.trim().toLowerCase()

    return bookings
      .map((booking) => ({
        ...booking,
        transactionId: `#${booking.id.slice(0, 4).toUpperCase()}-${booking.id.slice(-12)}`,
        patientName: patientNames[booking.patient_id] ?? booking.patient_id,
        doctorName: doctorNames[booking.provider_id] ?? booking.provider_id,
        commission: commissionOf(booking),
        ...(({ label, tone }) => ({ statusLabel: label, statusTone: tone }))(statusOf(booking)),
      }))
      .filter((row) => status === 'all' || row.status === status)
      .filter((row) => {
        const when = toDate(row.scheduled_at)
        if (!when) return !start && !end
        return (!start || when >= start) && (!end || when <= end)
      })
      .filter((row) => !needle || [row.transactionId, row.patientName, row.doctorName].some((field) => String(field).toLowerCase().includes(needle)))
      .sort((a, b) => (toDate(b.scheduled_at)?.getTime() ?? 0) - (toDate(a.scheduled_at)?.getTime() ?? 0))
  }, [bookings, users, providers, search, status, from, to])

  const columns = [
    { key: 'id', header: 'Transaction ID', render: (row) => <span className="font-mono text-xs font-bold">{row.transactionId}</span> },
    { key: 'patient', header: 'Patient', render: (row) => row.patientName },
    { key: 'doctor', header: 'Doctor', render: (row) => row.doctorName },
    { key: 'date', header: 'Consultation date', render: (row) => formatDate(row.scheduled_at) },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-bold">{formatPeso(row.fee)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge tone={row.statusTone}>{row.statusLabel}</StatusBadge> },
    { key: 'created', header: 'Transaction date', render: (row) => formatDateTime(row.created_at ?? row.scheduled_at) },
    { key: 'action', header: 'Action', align: 'right', render: (row) => <button type="button" onClick={() => setSelected(row)} className="font-bold text-brand hover:underline">View</button> },
  ]

  const exportCsv = () => {
    const csv = toCsv([
      { header: 'Transaction ID', value: (row) => row.transactionId },
      { header: 'Patient', value: (row) => row.patientName },
      { header: 'Doctor', value: (row) => row.doctorName },
      { header: 'Consultation date', value: (row) => formatDateTime(row.scheduled_at) },
      { header: 'Booking status', value: (row) => bookingStatusLabels[row.status] ?? row.status },
      { header: 'Payment status', value: (row) => row.statusLabel },
      { header: 'Fee (PHP)', value: (row) => Number(row.fee ?? 0).toFixed(2) },
      { header: 'Commission 15% (PHP)', value: (row) => row.commission.toFixed(2) },
    ], rows)
    downloadCsv(`diabeatis360-payments-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const download = () => {
    if (!printReceipt({ ...selected, consultationDate: selected.scheduled_at, method: selected.payment_method || '—', fee: selected.fee })) {
      setNotice('Your browser blocked the receipt window. Allow pop-ups for this page and try again.')
    }
  }

  const success = selected?.payment_status === 'paid'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput className="w-full max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transaction, patient or doctor…" />
        <Button variant="outline" onClick={() => setShowFilters((open) => !open)}>Filters</Button>
        <Button className="ml-auto flex items-center gap-2" onClick={exportCsv}><DownloadIcon className="h-4 w-4" /> Export Data</Button>
      </div>

      {showFilters ? (
        <div className="mb-4 grid gap-3 rounded-3xl border border-gray-100 bg-white p-4 md:grid-cols-3">
          <SelectField label="Booking status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {Object.entries(bookingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <label className="block text-sm font-medium text-ink">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" /></label>
          <label className="block text-sm font-medium text-ink">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" /></label>
        </div>
      ) : null}

      <DataTable columns={columns} rows={rows} pageSize={10} empty="No consultation payments match these filters." />

      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setNotice('') }}
        title="Payment Details"
        footer={selected ? (
          <div className="space-y-3">
            <Button className="w-full" onClick={download}>Download Invoice</Button>
            <a
              href={`mailto:diabeatis360@gmail.com?subject=${encodeURIComponent(`Payment problem ${selected.transactionId}`)}`}
              className="block w-full rounded-2xl border-2 border-gray-200 py-3 text-center text-sm font-bold text-muted hover:bg-gray-50"
            >
              Report a Problem
            </a>
            {notice ? <p className="text-center text-xs text-red-600">{notice}</p> : null}
          </div>
        ) : null}
      >
        {selected ? (
          <div>
            <div className="mb-4 rounded-3xl border border-gray-100 bg-page px-6 py-6 text-center">
              <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${success ? 'bg-brand-tint text-brand' : 'bg-gray-100 text-muted'}`}>
                <CheckCircleIcon className="h-7 w-7" />
              </span>
              <p className="mt-3 text-3xl font-extrabold">{formatPeso(selected.fee)}</p>
              <p className={`mt-1 text-xs font-extrabold uppercase tracking-wide ${success ? 'text-brand' : 'text-muted'}`}>
                {success ? 'Payment successful' : selected.statusLabel}
              </p>
              <p className="mt-2 text-xs text-muted">Transaction ID: <span className="font-bold text-ink">{selected.transactionId}</span></p>
            </div>
            {[
              ['Patient Name', selected.patientName],
              ['Doctor Name', selected.doctorName],
              ['Consultation Date', formatDate(selected.scheduled_at)],
              ['Payment Method', selected.payment_method || '—'],
              ['Platform Commission (15%)', formatPeso(selected.commission)],
              ['Transaction Date', formatDateTime(selected.created_at ?? selected.scheduled_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-gray-100 py-3 text-sm last:border-0">
                <span className="text-muted">{label}</span>
                <span className="font-bold">{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
