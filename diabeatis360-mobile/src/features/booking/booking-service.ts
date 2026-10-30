import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { DocumentReference, DocumentSnapshot } from 'firebase/firestore';

import { db } from '@/firebase';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import { platformCommission } from '@/constants/commission';
import { createNotification } from '@/features/notifications/notification-service';

import { isSameManilaDay, manilaSlotLabel } from './manila-time';
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
    isActive: data.is_active !== false,
    // Judged on the stored values, not on the display defaults above ("Philippines", "Diabetes care").
    profileComplete: isProfileComplete({
      specialty: String(data.specialty ?? ''),
      prcLicenseNumber: String(data.prc_license_number ?? ''),
      city: String(data.city ?? ''),
      consultationFee: Number(data.consultation_fee ?? 0),
    }),
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

// The doctor directory: only doctors an admin verified and who are still active can be booked (module 10).
// subscribeToProviders stays unfiltered because booking history still needs the names of doctors who were
// later deactivated.
export function subscribeToBookableProviders(
  onChange: (providers: Provider[]) => void,
  onError: (error: Error) => void,
) {
  return subscribeToProviders(
    // Only doctors patients can actually book: verified, active, and with a complete profile (city, fee...).
    (providers) => onChange(providers.filter((provider) => provider.isVerified && provider.isActive && provider.profileComplete)),
    onError,
  );
}

// The booking's document id is the doctor plus the slot (UTC, so every device agrees), e.g.
// "<providerId>_202609281400". Two patients picking the same slot therefore write the SAME document, which is
// what makes double-booking impossible rather than merely unlikely.
export function bookingIdFor(providerId: string, slot: Date) {
  return `${providerId}_${slot.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
}

// The Booked_Slots document for a doctor and a time (DECISIONS.md D22): "<providerId>_<epoch milliseconds>". firestore.rules
// builds the same id from the booking's data and refuses any other, so two bookings for one doctor and time always meet
// at this one document. It says only "taken or not"; it holds no patient information.
export function slotIdFor(providerId: string, slot: Date) {
  return `${providerId}_${slot.getTime()}`;
}

// The Care_Links document through which a patient shares their profile and readings with one doctor (D22).
const careLinkIdFor = (providerId: string, patientId: string) => `${providerId}_${patientId}`;

// Creates the booking as a REQUEST: the doctor has to accept before the patient
// is asked to pay, so no payment method is chosen here and nothing is marked paid.
// A slot is free if nobody holds it (never booked, or the earlier booking was declined/cancelled); otherwise someone
// got there first. The same write also takes the slot (Booked_Slots) and shares the patient's profile with the doctor
// (Care_Links); firestore.rules refuses a booking without both, so this is the friendly error, not the guard.
/** The longest concern a patient can send with a request (the rules refuse anything longer). */
export const CONCERN_LIMIT = 300;

/** Why a booking request was refused. The code lets the screen say it in the person's language (D33). */
export class BookingError extends Error {
  code: 'past' | 'guardian' | 'taken' | 'takenOrUnconfirmed';
  constructor(code: BookingError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export async function createBookingRequest(patientId: string, providerId: string, selectedDate: Date, fee: number, concern = '') {
  // A time that has already started cannot be booked (DECISIONS.md D26). firestore.rules checks the same thing against
  // the server's clock; this is the friendly message for a phone whose clock is right.
  if (selectedDate.getTime() <= Date.now()) throw new BookingError('past', 'That time has already passed. Please pick a later time.');
  // A pediatric account (DECISIONS.md D16) may not book a consultation until an admin approves the guardian
  // verification. firestore.rules enforces the same rule; this is only the friendly message before that.
  const patientSnapshot = await getDoc(doc(db, 'Users', patientId));
  if (patientSnapshot.data()?.account_type === 'minor') {
    const guardianSnapshot = await getDoc(doc(db, 'Guardian_Verifications', patientId));
    if (guardianSnapshot.data()?.verification_status !== 'approved') {
      throw new BookingError('guardian', 'This account needs guardian verification to be approved before booking a consultation. An admin is reviewing it, or you can resubmit it from Profile if it was rejected.');
    }
  }

  const reference = doc(db, 'Bookings', bookingIdFor(providerId, selectedDate));
  const slotReference = doc(db, 'Booked_Slots', slotIdFor(providerId, selectedDate));
  const linkReference = doc(db, 'Care_Links', careLinkIdFor(providerId, patientId));
  const scheduledAt = Timestamp.fromDate(selectedDate); // the same value in the booking and its slot: the rules compare them
  const record: BookingRecord = {
    patient_id: patientId,
    provider_id: providerId,
    status: 'pending',
    scheduled_at: scheduledAt,
    fee,
    platform_commission: platformCommission(fee),
    payment_status: 'unpaid',
    payment_method: null,
    queue_number: null,
    created_at: serverTimestamp(),
    // Only sent when the patient wrote something (D24): the doctor reads it on Request Details.
    ...(concern.trim() ? { concern: concern.trim().slice(0, CONCERN_LIMIT) } : {}),
  };
  const taken = 'That time slot was just booked by someone else. Please pick another time.';
  try {
    await runTransaction(db, async (transaction) => {
      // Other people's bookings are private, so "is it free?" is answered by the slot, not by reading the booking.
      const slot = await transaction.get(slotReference);
      if (slot.exists() && slot.data().active === true) throw new BookingError('taken', taken);
      transaction.set(reference, record);
      transaction.set(slotReference, { provider_id: providerId, scheduled_at: scheduledAt, booking_id: reference.id, active: true });
      transaction.set(linkReference, { provider_id: providerId, patient_id: patientId, booking_id: reference.id, updated_at: serverTimestamp() });
    });
  } catch (error) {
    // Losing a race for the slot, or an email that is not confirmed yet, both come back from the rules as "denied".
    if (typeof error === 'object' && error && (error as { code?: string }).code === 'permission-denied') {
      throw new BookingError('takenOrUnconfirmed', `${taken} (If this keeps happening, check that your email address is confirmed.)`);
    }
    throw error;
  }
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
            status: String(data.status ?? 'pending'),
            scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
            fee: Number(data.fee ?? 0),
            paymentStatus: (data.payment_status ?? 'unpaid') as PaymentStatus,
            paymentMethod: (data.payment_method ?? null) as PaymentMethod | null,
            queueNumber: typeof data.queue_number === 'number' ? data.queue_number : null,
            concern: String(data.concern ?? ''),
            declineReason: String(data.decline_reason ?? ''),
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
        // A name that cannot be read (a doctor whose patient stopped sharing) leaves the name blank instead of failing the screen.
        const [providerSnapshot, patientSnapshot] = await Promise.all([
          providerId ? getDoc(doc(db, 'Providers', providerId)).catch(() => null) : Promise.resolve(null),
          patientId ? getDoc(doc(db, 'Users', patientId)).catch(() => null) : Promise.resolve(null),
        ]);
        onChange({
          id: snapshot.id,
          provider: providerSnapshot?.exists() ? providerFromDoc(providerSnapshot) : null,
          patientId,
          patientName: String(patientSnapshot?.data()?.full_name ?? ''),
          status: String(data.status ?? 'pending'),
          scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
          fee: Number(data.fee ?? 0),
          paymentStatus: (data.payment_status ?? 'unpaid') as PaymentStatus,
          paymentMethod: (data.payment_method ?? null) as PaymentMethod | null,
          queueNumber: typeof data.queue_number === 'number' ? data.queue_number : null,
          concern: String(data.concern ?? ''),
          declineReason: String(data.decline_reason ?? ''),
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
          // The patient shared their profile with this doctor by booking (Care_Links, D22); if the name cannot be read, say so.
          const patientSnapshot = patientId ? await getDoc(doc(db, 'Users', patientId)).catch(() => null) : null;
          return {
            id: document.id,
            patientId,
            patientName: String(patientSnapshot?.data()?.full_name ?? 'Unknown patient'),
            scheduledAt: (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null,
            fee: Number(data.fee ?? 0),
            status: (data.status ?? 'pending') as BookingStatus,
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
      return data.status === 'confirmed' && scheduledAt?.toDateString() === day.toDateString();
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
/** The longest decline reason a doctor can give (the rules refuse anything longer). */
export const DECLINE_REASON_LIMIT = 500;

/** Accept or decline (or cancel) a booking. A decline may carry the doctor's reason, which the patient sees (D24). */
export async function updateBookingStatus(bookingId: string, status: BookingStatus, reason = '') {
  const reference = doc(db, 'Bookings', bookingId);
  const snapshot = await getDoc(reference);
  const data = snapshot.data();
  if (data && (status === 'declined' || status === 'cancelled')) {
    await releaseBooking(reference, data, status, status === 'declined' ? reason.trim().slice(0, DECLINE_REASON_LIMIT) : '');
  } else {
    await updateDoc(reference, { status });
  }
  if (!data) return;

  const providerId = String(data.provider_id ?? '');
  const patientId = String(data.patient_id ?? '');
  const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null;
  if (!providerId || !scheduledAt) return;

  const positions = await resequenceQueue(providerId, scheduledAt);
  if ((status !== 'confirmed' && status !== 'declined') || !patientId) return;

  const providerSnapshot = await getDoc(doc(db, 'Providers', providerId));
  const doctorName = String(providerSnapshot.data()?.full_name ?? 'your doctor');
  const queueNumber = positions.get(bookingId);
  const when = scheduledAt.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (status === 'declined') {
    // The patient learns about a decline (and the doctor's reason, D24) without having to open the app's lists.
    const why = reason.trim() ? ` Reason: ${reason.trim().slice(0, DECLINE_REASON_LIMIT)}` : '';
    try {
      await createNotification(patientId, 'booking_update', `${doctorName} declined your request for ${when}.${why}`, 'info', bookingId);
    } catch {
      // The decline itself is saved; a missing note must not make the doctor think it failed.
    }
    return;
  }
  const queueLine = queueNumber ? ` You are number ${queueNumber} in the queue for that day.` : '';
  await createNotification(
    patientId,
    'booking_update',
    `${doctorName} confirmed your consultation on ${when}.${queueLine}`,
    'info',
    bookingId,
  );
}

// A decline or cancellation: the booking, the time slot it held and (when this was the patient's last live booking with
// the doctor) the patient's share with the doctor are changed in ONE write (DECISIONS.md D22). firestore.rules refuses a
// decline that leaves the slot marked taken, and lets the doctor drop the share only when the booking it points to is no
// longer live. A patient who still has another live booking with this doctor keeps being shared, so their other
// appointments are not cut off.
async function releaseBooking(reference: DocumentReference, data: Record<string, unknown>, status: 'declined' | 'cancelled', reason: string) {
  const providerId = String(data.provider_id ?? '');
  const patientId = String(data.patient_id ?? '');
  const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null;
  const batch = writeBatch(db);
  batch.update(reference, reason ? { status, queue_number: null, decline_reason: reason } : { status, queue_number: null });
  if (!providerId || !scheduledAt) {
    await batch.commit();
    return;
  }
  batch.update(doc(db, 'Booked_Slots', slotIdFor(providerId, scheduledAt)), { active: false });

  const linkReference = doc(db, 'Care_Links', careLinkIdFor(providerId, patientId));
  const [mine, link] = await Promise.all([
    getDocs(query(collection(db, 'Bookings'), where('provider_id', '==', providerId))),
    getDoc(linkReference).catch(() => null), // an older booking may have no share to drop
  ]);
  const stillLive = mine.docs.some((other) => other.id !== reference.id
    && other.data().patient_id === patientId
    && ['pending', 'confirmed', 'completed'].includes(String(other.data().status)));
  if (!stillLive && link?.exists()) batch.delete(linkReference);
  await batch.commit();
}

// Which "09:30 AM"-style slots are already taken for one provider on one day, so the time picker can gray those out
// instead of allowing a double-book. It reads Booked_Slots (a doctor, a time, taken or not), not the bookings: other
// patients' bookings are private (DECISIONS.md D22). Single equality filter, filtered client-side, so no composite index.
export function subscribeToBookedTimes(
  providerId: string,
  date: Date,
  onChange: (bookedTimes: Set<string>) => void,
  onError: (error: Error) => void,
) {
  const slotsQuery = query(collection(db, 'Booked_Slots'), where('provider_id', '==', providerId));
  return onSnapshot(
    slotsQuery,
    (snapshot) => {
      const bookedTimes = new Set<string>();
      for (const document of snapshot.docs) {
        const data = document.data();
        if (data.active !== true) continue;
        const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate();
        // Compared in Philippine time (D26), the same way the picker builds its slots; labels are 09:30 AM-style.
        if (!scheduledAt || !isSameManilaDay(scheduledAt, date)) continue;
        bookedTimes.add(manilaSlotLabel(scheduledAt));
      }
      onChange(bookedTimes);
    },
    (error) => onError(error),
  );
}
