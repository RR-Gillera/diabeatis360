import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';

import type { AppointmentHistoryEntry, BookingRecord, BookingStatus, Provider, ProviderBookingEntry } from './types';

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

export async function createBooking(patientId: string, providerId: string, selectedDate: Date, fee: number) {
  const record: BookingRecord = {
    patient_id: patientId,
    provider_id: providerId,
    status: 'scheduled',
    scheduled_at: Timestamp.fromDate(selectedDate),
    fee,
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Bookings'), record);
  return reference.id;
}

// Joins each booking with its provider client-side (Bookings only stores provider_id,
// matching the finalized ERD — no denormalized provider fields on the booking itself).
// Sorted client-side rather than via a Firestore `orderBy` so this doesn't need a
// composite index (patient_id equality + scheduled_at order) provisioned up front.
export function subscribeToBookingHistory(
  patientId: string,
  providers: Provider[],
  onChange: (entries: AppointmentHistoryEntry[]) => void,
  onError: (error: Error) => void,
) {
  const bookingsQuery = query(collection(db, 'Bookings'), where('patient_id', '==', patientId));
  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      const entries = snapshot.docs
        .map((document) => {
          const data = document.data();
          const provider = providers.find((candidate) => candidate.id === data.provider_id) ?? null;
          return {
            id: document.id,
            provider,
            status: String(data.status ?? 'scheduled'),
            scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
            fee: Number(data.fee ?? 0),
          };
        })
        .sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0));
      onChange(entries);
    },
    (error) => onError(error),
  );
}

// The doctor-side mirror of subscribeToBookingHistory: same single-equality-filter,
// no-orderBy, sort-client-side shape (this time on provider_id) to avoid needing a
// composite index. Patient identity is resolved per booking via a Users lookup —
// fine at capstone-demo scale; an `in` query batch is the natural upgrade later.
export function subscribeToBookingsForProvider(
  providerId: string,
  onChange: (entries: ProviderBookingEntry[]) => void,
  onError: (error: Error) => void,
) {
  const bookingsQuery = query(collection(db, 'Bookings'), where('provider_id', '==', providerId));
  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      void (async () => {
        const entries = await Promise.all(snapshot.docs.map(async (document) => {
          const data = document.data();
          const patientId = String(data.patient_id ?? '');
          const patientSnapshot = patientId ? await getDoc(doc(db, 'Users', patientId)) : null;
          return {
            id: document.id,
            patientId,
            patientName: String(patientSnapshot?.data()?.full_name ?? 'Unknown patient'),
            scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
            fee: Number(data.fee ?? 0),
            status: (data.status ?? 'scheduled') as BookingStatus,
          };
        }));
        entries.sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));
        onChange(entries);
      })();
    },
    (error) => onError(error),
  );
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  await updateDoc(doc(db, 'Bookings', bookingId), { status });
}
