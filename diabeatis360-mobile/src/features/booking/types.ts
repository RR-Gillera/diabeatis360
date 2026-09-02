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

export type PaymentMethod = 'GCash' | 'Maya' | 'Credit / Debit Card';

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
  created_at: ReturnType<typeof import('firebase/firestore').serverTimestamp>;
};

export type AppointmentHistoryEntry = {
  id: string;
  provider: Provider | null;
  status: string;
  scheduledAt: Date | null;
  fee: number;
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
};
