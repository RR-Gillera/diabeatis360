import type { Timestamp } from 'firebase/firestore';

export type Provider = {
  id: string;
  fullName: string;
  specialty: string;
  prcLicenseNumber: string;
  city: string;
  consultationFee: number;
  isVerified: boolean;
};

export type PaymentMethod = 'GCash' | 'Maya' | 'Credit / Debit Card' | 'Pay On-Site';

// Payment now happens AFTER the doctor accepts, so a booking carries a payment
// state of its own rather than only existing once money changed hands.
// 'onsite' means settled in person at the clinic, not online.
export type PaymentStatus = 'unpaid' | 'paid' | 'onsite';

export type BookingDraft = {
  provider: Provider | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  paymentMethod: PaymentMethod | null;
  bookingId: string | null;
};

export type BookingStatus = 'scheduled' | 'accepted' | 'declined';

export type BookingRecord = {
  patient_id: string;
  provider_id: string;
  status: BookingStatus;
  scheduled_at: Timestamp;
  fee: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  /** Assigned when the doctor accepts — null while the request is pending. */
  queue_number: number | null;
  created_at: ReturnType<typeof import('firebase/firestore').serverTimestamp>;
};

export type AppointmentHistoryEntry = {
  id: string;
  provider: Provider | null;
  patientId: string;
  /** Resolved by subscribeToBooking only — the list query would need one extra
   *  read per booking, and the patient viewing their own history already knows
   *  their name. Empty string when not resolved. */
  patientName: string;
  status: string;
  scheduledAt: Date | null;
  fee: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  /** Position in this doctor's queue for that day. Null until accepted. */
  queueNumber: number | null;
};

// The doctor-side mirror of AppointmentHistoryEntry — needs patient identity, not
// provider identity, since this is the doctor's own booking queue.
export type ProviderBookingEntry = {
  id: string;
  patientId: string;
  patientName: string;
  scheduledAt: Date | null;
  fee: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  queueNumber: number | null;
};
