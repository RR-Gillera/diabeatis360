import { useMemo, useState } from 'react'

import DataTable from '../components/DataTable'
import { Button, Card, Notice, PageHeader } from '../components/ui'
import { downloadCsv, toCsv } from '../lib/csv'
import { buildReport, reportTypes } from '../lib/reports'
import { useCollection } from '../lib/useCollection'

// Generate System Reports (module 9, admin): pick a report and a date range, then download it as CSV or print it
// (the browser's "Save as PDF" turns the print view into a PDF). Everything is built in the browser.
export default function ReportsPage() {
  const users = useCollection('Users')
  const providers = useCollection('Providers')
  const bookings = useCollection('Bookings')
  const glucose = useCollection('Glucose_Logs')
  const [type, setType] = useState('bookings')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const report = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : null
    const end = to ? new Date(`${to}T23:59:59`) : null
    return buildReport(type, { users: users.data, providers: providers.data, bookings: bookings.data, glucose: glucose.data }, start, end)
  }, [type, from, to, users.data, providers.data, bookings.data, glucose.data])

  const tableColumns = report.columns.map((column, index) => ({
    key: String(index),
    header: column.header,
    render: (row) => column.value(row),
  }))

  const rangeLabel = from || to ? `${from || 'the beginning'} to ${to || 'today'}` : 'all time'
  const error = users.error || providers.error || bookings.error || glucose.error

  const onDownload = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`diabeatis360-${type}-report-${stamp}.csv`, toCsv(report.columns, report.rows))
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title="Reports" subtitle="Generate a report, then download it as CSV or print it to PDF." />
        {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium">
              Report
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand">
                {reportTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm" />
            </label>
            <label className="text-sm font-medium">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm" />
            </label>
            <div className="flex gap-2">
              <Button onClick={onDownload} disabled={report.rows.length === 0}>Download CSV</Button>
              <Button variant="outline" onClick={() => window.print()} disabled={report.rows.length === 0}>Print / Save as PDF</Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{reportTypes.find((option) => option.value === type)?.description}</p>
        </Card>
      </div>

      <div className="mb-3 hidden print:block">
        <p className="text-xl font-extrabold">Diabeatis360 — {report.title}</p>
        <p className="text-sm">Range: {rangeLabel} · Generated {new Date().toLocaleString('en-PH')} · {report.rows.length} rows</p>
      </div>
      <p className="mb-3 text-sm text-muted print:hidden">{report.rows.length} rows · {rangeLabel}</p>
      <DataTable columns={tableColumns} rows={report.rows} getKey={(row) => row.id ?? row.patientId} empty="No data for this report and date range." />
    </div>
  )
}
