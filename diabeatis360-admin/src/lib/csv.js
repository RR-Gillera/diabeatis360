// CSV export without a library. Every cell is quoted, and quotes inside a cell are doubled, so commas or
// line breaks in names and notes cannot break the file.
export function toCsv(columns, rows) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const header = columns.map((column) => escape(column.header)).join(',')
  const lines = rows.map((row) => columns.map((column) => escape(column.value(row))).join(','))
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(filename, csv) {
  // The BOM makes Excel read the file as UTF-8 (so the peso sign and Filipino names display correctly).
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
