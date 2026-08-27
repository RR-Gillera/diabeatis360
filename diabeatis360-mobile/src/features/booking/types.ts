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

export type BookingRecord = {
  patient_id: string;
  provider_id: string;
  status: 'scheduled';
  scheduled_at: Timestamp;
  fee: number;
  created_at: ReturnType<typeof import('firebase/firestore').serverTimestamp>;
};
