import { formatDateTime, formatPeso } from './format'
import { escapeHtml, openPrintWindow } from './printHtml'

/** "Download Invoice": a clean one-page receipt; in the print dialog the admin picks "Save as PDF". */
export function printReceipt(payment) {
  const rows = [
    ['Transaction ID', payment.transactionId],
    ['Patient', payment.patientName],
    ['Doctor', payment.doctorName],
    ['Consultation date', formatDateTime(payment.consultationDate)],
    ['Payment method', payment.method],
    ['Payment status', payment.statusLabel],
    ['Consultation fee', formatPeso(payment.fee)],
    ['Platform commission (15%)', formatPeso(payment.commission)],
  ]
  const body = `<h1>Diabeatis360</h1><p class="sub">Consultation payment receipt</p>
<table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td><b>${escapeHtml(value)}</b></td></tr>`).join('')}</table>
<p class="note">Payments in this version are recorded by the app, not charged to a card. Keep this receipt for your records.</p>`
  return openPrintWindow(`Receipt ${payment.transactionId}`, body)
}
