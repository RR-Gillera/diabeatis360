import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';

import { db } from '@/firebase';

import type { AppointmentHistoryEntry, BookingRecord, BookingStatus, Provider, ProviderBookingEntry } from './types';

// Shared Firestore-doc-to-Provider mapping, used by both subscribeToProviders
// (list) and subscribeToBooking (single join) so the field mapping only lives
// in one place.
function providerFromDoc(document: DocumentSnapshot): Provider {
  const data = document.data() ?? {};
  return {
    id: document.id,
    fullName: String(data.full_name ?? 'Unnamed provider'),
    specialty: String(data.specialty ?? 'Diabetes care'),
    prcLicenseNumber: String(data.prc_license_number ?? ''),
    city: String(data.city ?? 'Philippines'),
    consultationFee: Number(data.consultation_fee ?? 0),
    isVerified: Boolean(data.is_verified),
  };
}

export function subscribeToProviders(
  onChange: (providers: Provider[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'Providers'),
    (snapshot) => onChange(snapshot.docs.map(providerFromDoc)),
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

// Single-booking lookup by ID, provider joined the same way as
// subscribeToBookingHistory — used for the appointment detail screen, whether
// reached from a history list or straight from the payment-success flow.
export function subscribeToBooking(
  bookingId: string,
  onChange: (entry: AppointmentHistoryEntry | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'Bookings', bookingId),
    (snapshot) => {
      void (async () => {
        if (!snapshot.exists()) { onChange(null); return; }
        const data = snapshot.data();
        const providerId = String(data.provider_id ?? '');
        const providerSnapshot = providerId ? await getDoc(doc(db, 'Providers', providerId)) : null;
        onChange({
          id: snapshot.id,
          provider: providerSnapshot?.exists() ? providerFromDoc(providerSnapshot) : null,
          status: String(data.status ?? 'scheduled'),
          scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
          fee: Number(data.fee ?? 0),
        });
      })();
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

// Which "09:30 AM"-style slots are already taken for one provider on one day,
// so the time picker can gray those out instead of allowing a double-book.
// Same single-equality-filter, sort/filter-client-side shape as the other
// subscribe* functions here, to avoid needing a composite index.
export function subscribeToBookedTimes(
  providerId: string,
  date: Date,
  onChange: (bookedTimes: Set<string>) => void,
  onError: (error: Error) => void,
) {
  const bookingsQuery = query(collection(db, 'Bookings'), where('provider_id', '==', providerId));
  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      const bookedTimes = new Set<string>();
      for (const document of snapshot.docs) {
        const data = document.data();
        if (data.status === 'declined') continue;
        const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate();
        if (!scheduledAt || scheduledAt.toDateString() !== date.toDateString()) continue;
        // hour: '2-digit' zero-pads to match the "09:30 AM"-style labels in the time picker.
        bookedTimes.add(scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      }
      onChange(bookedTimes);
    },
    (error) => onError(error),
  );
}
