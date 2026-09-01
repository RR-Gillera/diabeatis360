import { addDoc, collection, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';

import { db } from '@/firebase';

import type { BookingRecord, Provider } from './types';

export function subscribeToProviders(
  onChange: (providers: Provider[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'Providers'),
    (snapshot) => {
      const providers = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          fullName: String(data.full_name ?? 'Unnamed provider'),
          specialty: String(data.specialty ?? 'Diabetes care'),
          prcLicenseNumber: String(data.prc_license_number ?? ''),
          city: String(data.city ?? 'Philippines'),
          consultationFee: Number(data.consultation_fee ?? 0),
          isVerified: Boolean(data.is_verified),
        };
      });
      onChange(providers);
    },
    (error) => onError(error),
  );
}

export async function createBooking(providerId: string, selectedDate: Date, fee: number) {
  const record: BookingRecord = {
    patient_id: 'test-patient-001',
    provider_id: providerId,
    status: 'scheduled',
    scheduled_at: Timestamp.fromDate(selectedDate),
    fee,
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Bookings'), record);
  return reference.id;
}
