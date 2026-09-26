// Display labels for the enum codes stored in Firestore (same codes as the mobile app's constants/enums.ts, D6).
export const bookingStatusLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export const bookingStatusTone = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  declined: 'danger',
  cancelled: 'danger',
}

export const paymentStatusLabels = { unpaid: 'Unpaid', paid: 'Paid', onsite: 'Pay on-site' }

export const PLATFORM_COMMISSION_RATE = 0.15 // DECISIONS.md D3; the same rate the mobile app and firestore.rules use

/** Commission for a booking: the stored value, or 15% of the fee for older bookings made before it was stored. */
export function commissionOf(booking) {
  if (typeof booking.platform_commission === 'number') return booking.platform_commission
  return Math.round(Number(booking.fee ?? 0) * PLATFORM_COMMISSION_RATE * 100) / 100
}
