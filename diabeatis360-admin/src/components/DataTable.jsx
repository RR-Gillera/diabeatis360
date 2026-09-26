// A plain table shell used by the admin list pages: columns = [{ key, header, render(row), align }].
export default function DataTable({ columns, rows, empty = 'Nothing to show yet.', getKey = (row) => row.id }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-muted">
            {columns.map((column) => (
              <th key={column.key} className={`px-5 py-4 font-bold ${column.align === 'right' ? 'text-right' : ''}`}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-5 py-10 text-center text-muted">{empty}</td></tr>
          ) : rows.map((row) => (
            <tr key={getKey(row)} className="border-b border-gray-50 last:border-0">
              {columns.map((column) => (
                <td key={column.key} className={`px-5 py-4 align-middle ${column.align === 'right' ? 'text-right' : ''}`}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Filter tabs: options = [{ value, label, count? }]. */
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
