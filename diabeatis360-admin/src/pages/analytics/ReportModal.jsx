import { useMemo, useState } from 'react'

import { DownloadIcon } from '../../components/icons'
import { Button, Modal, Notice, SelectField } from '../../components/ui'
import { downloadCsv, toCsv } from '../../lib/csv'
import { escapeHtml, openPrintWindow } from '../../lib/printHtml'
import { buildReport, reportTypes } from '../../lib/reports'

const toInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// "Generate Custom Report" (FIGMA/ADMIN Analytics Page-1; manuscript Generate System Reports + UT-A012 blood sugar
// trends). Pick a report type and dates, press Generate Preview, then Print (Save as PDF) or Export CSV.
export default function ReportModal({ open, onClose, initialRange, data }) {
  if (!open) return null
  return <ReportModalBody onClose={onClose} initialRange={initialRange} data={data} />
}

// A separate inner component so its form state starts fresh every time the modal opens.
function ReportModalBody({ onClose, initialRange, data }) {
  const [type, setType] = useState('health')
  const [from, setFrom] = useState(toInput(initialRange.start))
  const [to, setTo] = useState(toInput(initialRange.end))
  const [generated, setGenerated] = useState(null) // { type, from, to } that the preview was built for
  const [notice, setNotice] = useState('')

  const report = useMemo(() => {
    if (!generated) return null
    const start = generated.from ? new Date(`${generated.from}T00:00:00`) : null
    const end = generated.to ? new Date(`${generated.to}T23:59:59`) : null
    return buildReport(generated.type, data, start, end)
  }, [generated, data])

  const period = generated ? `${generated.from || 'the beginning'} to ${generated.to || 'today'}` : ''
  const invalidRange = from && to && from > to

  const exportCsv = () => downloadCsv(`diabeatis360-${generated.type}-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(report.columns, report.rows))

  const print = () => {
    const body = `<h1>Diabeatis360</h1><p class="sub">${escapeHtml(report.title)} · Period: ${escapeHtml(period)} · Generated ${escapeHtml(new Date().toLocaleString('en-PH'))}</p>
<div class="tiles">${report.summary.map((tile) => `<div class="tile"><span>${escapeHtml(tile.label)}</span><b>${escapeHtml(tile.value)}</b></div>`).join('')}</div>
<table><thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('')}</tr></thead>
<tbody>${report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('')}</tbody></table>
<p class="note">Automated report built from live system data. Blood sugar figures are informational and not a diagnosis.</p>`
    if (!openPrintWindow(report.title, body)) setNotice('Your browser blocked the print window. Allow pop-ups for this page and try again.')
  }

  return (
    <Modal open onClose={onClose} title="Generate Custom Report" maxWidth="max-w-5xl">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <SelectField label="Report type" value={type} onChange={(e) => setType(e.target.value)}>
            {reportTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          <p className="text-xs text-muted">{reportTypes.find((option) => option.value === type)?.description}</p>
          <label className="block text-sm font-medium text-ink">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
          </label>
          <label className="block text-sm font-medium text-ink">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
          </label>
          {invalidRange ? <Notice>The start date must be before the end date.</Notice> : null}
          <Button className="w-full" disabled={invalidRange} onClick={() => { setGenerated({ type, from, to }); setNotice('') }}>Generate Preview</Button>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
            <p className="text-xs font-extrabold uppercase tracking-widest">Report preview</p>
            <div className="flex gap-2">
              <Button variant="outline" className="!border-gray-200 !px-4 !py-2 !text-ink" disabled={!report} onClick={print}>Print</Button>
              <button
                type="button"
                disabled={!report}
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                <DownloadIcon className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>
          {notice ? <div className="mb-3"><Notice>{notice}</Notice></div> : null}

          {!report ? (
            <p className="rounded-2xl bg-page px-4 py-10 text-center text-sm text-muted">Choose a report type and dates, then press Generate Preview.</p>
          ) : (
            <div className="rounded-3xl border border-gray-100">
              <div className="border-b border-gray-100 bg-page px-5 py-4">
                <p className="text-lg font-extrabold">{report.title}</p>
                <p className="text-sm text-muted">Period: {period}</p>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {report.summary.map((tile) => (
                  <div key={tile.label} className="rounded-2xl bg-brand-tint/60 p-4">
                    <p className="text-[11px] font-bold uppercase text-muted">{tile.label}</p>
                    <p className="mt-1 text-2xl font-extrabold">{tile.value}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-72 overflow-auto px-5 pb-5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">{report.columns.map((column) => <th key={column.header} className="py-2 pr-3 font-bold">{column.header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {report.rows.slice(0, 50).map((row, index) => (
                      <tr key={row.id ?? row.patientId ?? index} className="border-t border-gray-100">
                        {report.columns.map((column) => <td key={column.header} className="py-2 pr-3">{column.value(row)}</td>)}
                      </tr>
                    ))}
                    {report.rows.length === 0 ? <tr><td colSpan={report.columns.length} className="py-6 text-center text-muted">No data for this report and date range.</td></tr> : null}
                  </tbody>
                </table>
                {report.rows.length > 50 ? <p className="mt-2 text-xs text-muted">Preview shows the first 50 of {report.rows.length} rows. Print and CSV include all rows.</p> : null}
              </div>
            </div>
          )}
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <b>Note</b> — This report is an automated preview built from current system data.
          </p>
        </div>
      </div>
    </Modal>
  )
}
