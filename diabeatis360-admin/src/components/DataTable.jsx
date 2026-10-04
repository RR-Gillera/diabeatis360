import { useState } from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from './icons'

// A plain table shell used by the admin list pages: columns = [{ key, header, render(row), align }].
// pageSize turns on client-side pagination (FIGMA/ADMIN "Showing 1-10 of 1,240 ‹ ›"); omit it for tables
// that should always show every row (Plans, Points, printable reports).
export default function DataTable({ columns, rows, empty = 'Nothing to show yet.', getKey = (row) => row.id, pageSize }) {
  const [requestedPage, setPage] = useState(0)
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1
  // If the filtered row count shrinks (e.g. a new search term), fall back to the last page that still exists.
  const page = Math.min(requestedPage, pageCount - 1)

  const shown = pageSize ? rows.slice(page * pageSize, page * pageSize + pageSize) : rows

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-muted">
              {columns.map((column) => (
                <th key={column.key} className={`px-5 py-4 font-bold ${column.align === 'right' ? 'text-right' : ''}`}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-10 text-center text-muted">{empty}</td></tr>
            ) : shown.map((row) => (
              <tr key={getKey(row)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                {columns.map((column) => (
                  <td key={column.key} className={`px-5 py-4 align-middle ${column.align === 'right' ? 'text-right' : ''}`}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && rows.length > 0 ? (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-muted">
          <span>Showing {page * pageSize + 1}-{Math.min(rows.length, page * pageSize + pageSize)} of {rows.length}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="rounded-full border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              className="rounded-full border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Filter tabs: options = [{ value, label, count? }]. Rounded-pill style, used for in-page filters. */
export function Tabs({ options, value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${value === option.value ? 'bg-brand text-white' : 'bg-white text-muted hover:bg-gray-100'}`}
        >
          {option.label}{option.count !== undefined ? ` (${option.count})` : ''}
        </button>
      ))}
    </div>
  )
}
