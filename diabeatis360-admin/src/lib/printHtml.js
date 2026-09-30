// Print helpers shared by the receipt and the report preview. Both build a small standalone HTML page and open the
// browser's print dialog, where "Save as PDF" makes a PDF — so no PDF library is needed.

/** Every value that ends up in the printed HTML goes through this, because names and notes come from users. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export const printStyles = `
  body { font-family: Inter, Arial, sans-serif; color: #1a1a1a; max-width: 900px; margin: 40px auto; padding: 0 24px; }
  h1 { color: #629c2c; margin: 0 0 4px; } p.sub { color: #6b7280; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; } th, td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { color: #6b7280; font-size: 11px; text-transform: uppercase; }
  .tiles { display: flex; gap: 12px; margin-bottom: 20px; } .tile { flex: 1; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
  .tile b { display: block; font-size: 20px; } .tile span { color: #6b7280; font-size: 11px; text-transform: uppercase; }
  .note { margin-top: 24px; font-size: 12px; color: #6b7280; }
`

/** Opens `bodyHtml` in a new tab and prints it. Returns false when the browser blocked the pop-up. */
export function openPrintWindow(title, bodyHtml) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${printStyles}</style></head><body>${bodyHtml}</body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}
