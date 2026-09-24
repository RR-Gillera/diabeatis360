import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';

import { db } from '@/firebase';
import { createNotification } from '@/features/notifications/notification-service';

import type { AppointmentHistoryEntry, BookingRecord, BookingStatus, PaymentMethod, PaymentStatus, Provider, ProviderBookingEntry } from './types';

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

// Creates the booking as a REQUEST: the doctor has to accept before the patient
// is asked to pay, so no payment method is chosen here and nothing is marked paid.
export async function createBookingRequest(patientId: string, providerId: string, selectedDate: Date, fee: number) {
  const record: BookingRecord = {
    patient_id: patientId,
    provider_id: providerId,
    status: 'scheduled',
    scheduled_at: Timestamp.fromDate(selectedDate),
    fee,
    payment_status: 'unpaid',
    payment_method: null,
    queue_number: null,
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Bookings'), record);
  return reference.id;
}

// Settles payment on an already-accepted booking. Paying on-site records the
// intent rather than money received — the clinic collects it in person.
export async function payForBooking(bookingId: string, method: PaymentMethod) {
  await updateDoc(doc(db, 'Bookings', bookingId), {
    payment_method: method,
    payment_status: method === 'Pay On-Site' ? 'onsite' : 'paid',
  });
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
            patientId: String(data.patient_id ?? ''),
            patientName: '',
            status: String(data.status ?? 'scheduled'),
            scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
            fee: Number(data.fee ?? 0),
            paymentStatus: (data.payment_status ?? 'unpaid') as PaymentStatus,
            paymentMethod: (data.payment_method ?? null) as PaymentMethod | null,
            queueNumber: typeof data.queue_number === 'number' ? data.queue_number : null,
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
        const patientId = String(data.patient_id ?? '');
        // Both sides of the booking are joined here so a consultation can name
        // the person on the other end, whichever role is viewing.
        const [providerSnapshot, patientSnapshot] = await Promise.all([
          providerId ? getDoc(doc(db, 'Providers', providerId)) : Promise.resolve(null),
          patientId ? getDoc(doc(db, 'Users', patientId)) : Promise.resolve(null),
        ]);
        onChange({
          id: snapshot.id,
          provider: providerSnapshot?.exists() ? providerFromDoc(providerSnapshot) : null,
          patientId,
          patientName: String(patientSnapshot?.data()?.full_name ?? ''),
          status: String(data.status ?? 'scheduled'),
          scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
          fee: Number(data.fee ?? 0),
          paymentStatus: (data.payment_status ?? 'unpaid') as PaymentStatus,
          paymentMethod: (data.payment_method ?? null) as PaymentMethod | null,
          queueNumber: typeof data.queue_number === 'number' ? data.queue_number : null,
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
            paymentStatus: (data.payment_status ?? 'unpaid') as PaymentStatus,
            paymentMethod: (data.payment_method ?? null) as PaymentMethod | null,
            queueNumber: typeof data.queue_number === 'number' ? data.queue_number : null,
          };
        }));
        entries.sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));
        onChange(entries);
      })();
    },
    (error) => onError(error),
  );
}

/**
 * Renumbers a doctor's accepted bookings for one day, earliest slot first.
 *
 * Recomputed on every accept/decline rather than handing out an incrementing
 * counter: slots are booked out of order, so a patient accepted later can hold
 * an earlier time and genuinely belongs ahead in the queue. A counter would
 * tell that patient they were last when they are actually seen first, and would
 * leave gaps behind every declined booking.
 */
async function resequenceQueue(providerId: string, day: Date) {
  const sameProvider = await getDocs(query(collection(db, 'Bookings'), where('provider_id', '==', providerId)));
  const sameDay = sameProvider.docs
    .filter((entry) => {
      const data = entry.data();
      const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate();
      return data.status === 'accepted' && scheduledAt?.toDateString() === day.toDateString();
    })
    .sort((a, b) => {
      const left = (a.data().scheduled_at as Timestamp | undefined)?.toDate()?.getTime() ?? 0;
      const right = (b.data().scheduled_at as Timestamp | undefined)?.toDate()?.getTime() ?? 0;
      return left - right;
    });

  const positions = new Map<string, number>();
  await Promise.all(sameDay.map((entry, index) => {
    const position = index + 1;
    positions.set(entry.id, position);
    // Skip the write when the stored number is already right, so a decline at
    // the end of the day doesn't rewrite every earlier booking for nothing.
    if (entry.data().queue_number === position) return Promise.resolve();
    return updateDoc(entry.ref, { queue_number: position });
  }));
  return positions;
}

/**
 * Accepts or declines a booking, then keeps that day's queue numbers correct
 * and tells the patient where they stand.
 *
 * Only the accepted patient is notified. Patients whose number shifts because
 * someone ahead of them was accepted or declined see the new number on their
 * appointment screen, but are not re-notified — a queue that pinged everyone
 * every time it moved would be noise, not news.
 */
export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const reference = doc(db, 'Bookings', bookingId);
  const snapshot = await getDoc(reference);
  const data = snapshot.data();
  await updateDoc(reference, { status, ...(status === 'declined' ? { queue_number: null } : {}) });
  if (!data) return;

  const providerId = String(data.provider_id ?? '');
  const patientId = String(data.patient_id ?? '');
  const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null;
  if (!providerId || !scheduledAt) return;

  const positions = await resequenceQueue(providerId, scheduledAt);
  if (status !== 'accepted' || !patientId) return;

  const providerSnapshot = await getDoc(doc(db, 'Providers', providerId));
  const doctorName = String(providerSnapshot.data()?.full_name ?? 'your doctor');
  const queueNumber = positions.get(bookingId);
  const when = scheduledAt.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const queueLine = queueNumber ? ` You are number ${queueNumber} in the queue for that day.` : '';
  await createNotification(
    patientId,
    'booking_update',
    `${doctorName} confirmed your consultation on ${when}.${queueLine}`,
    'info',
    bookingId,
  );
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
