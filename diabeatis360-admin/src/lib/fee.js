// The consultation fee rule (QA ADM-005, DECISIONS.md D46), the same as the mobile app's constants/fees.ts: more than ₱0
// and at most ₱20,000. firestore.rules (Providers) refuses a fee below 0 or above 20,000 whatever a screen does, so
// change all three together. (The rules allow 0, meaning "not set yet", but a doctor added here is verified at once and
// should be bookable, and Find a Doctor lists only fees above ₱0, so this form asks for more than ₱0.)
// No Firebase imports, so plain Node tests it (fee.test.js).

export const MAX_CONSULTATION_FEE = 20000

/** Reads a typed fee: commas, spaces and a peso sign are ignored; a minus sign is kept; anything else gives NaN. */
export function parseFee(text) {
  const cleaned = String(text ?? '').replace(/[₱,\s]/g, '')
  return cleaned ? Number(cleaned) : NaN
}

/** The message for a typed fee that cannot be saved, or '' when it can. */
export function feeProblem(text) {
  const fee = parseFee(text)
  if (!Number.isFinite(fee) || fee <= 0) return 'Enter a consultation fee above ₱0.'
  if (fee > MAX_CONSULTATION_FEE) return `That fee looks too high. The most the app accepts is ₱${MAX_CONSULTATION_FEE.toLocaleString('en-PH')}.`
  return ''
}

/** A valid typed fee as it is stored: a number rounded to the centavo. */
export function storedFee(text) {
  return Math.round(parseFee(text) * 100) / 100
}
