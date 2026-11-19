import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';

import { db } from '@/firebase';
import type { ConsultationStatus } from '@/constants/enums';
import { createNotification } from '@/features/notifications/notification-service';

export type { ConsultationStatus };

export type SenderRole = 'patient' | 'doctor';

export type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
  sentAt: Date | null;
};

/** What the doctor writes when ending (Figma D-07, DECISIONS D24): Diagnosis notes (stored as "summary"), Advice, Follow-up. */
export type ConsultationNotes = {
  summary: string;
  advice: string;
  followUpAt: Date | null;
};

export type ConsultationState = ConsultationNotes & {
  status: ConsultationStatus;
  endedAt: Date | null;
};

// Messages live in their own flat collection keyed by booking_id, matching the
// ERD's convention of plain-string foreign keys rather than subcollections.
// Consultation state (active/ended) lives on the Bookings doc itself, since the booking IS the consultation. The
// doctor's WRITTEN summary is its own document, Consultation_Notes/{bookingId} (DECISIONS.md D22): it used to sit on the
// booking, which many people could read; now only the two people on that booking can.
export async function sendMessage(bookingId: string, senderId: string, senderRole: SenderRole, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'Messages'), {
    booking_id: bookingId,
    sender_id: senderId,
    sender_role: senderRole,
    message: trimmed,
    sent_at: serverTimestamp(),
  });
  // First message opens the consultation, so neither side has to press "start".
  await setDoc(doc(db, 'Bookings', bookingId), { consultation_status: 'active' }, { merge: true });

  // Notify the OTHER party — the booking is what tells us who that is. A failed
  // notification must never lose the message that was already delivered.
  try {
    const booking = await getDoc(doc(db, 'Bookings', bookingId));
    const data = booking.data();
    if (!data) return;
    const recipientId = senderRole === 'doctor' ? String(data.patient_id ?? '') : String(data.provider_id ?? '');
    if (!recipientId || recipientId === senderId) return;
    // Name the sender rather than their role — "Dr. Santos sent you a message"
    // is far more useful in a notification list than "Your doctor".
    const senderDoc = await getDoc(doc(db, senderRole === 'doctor' ? 'Providers' : 'Users', senderId));
    const senderName = String(senderDoc.data()?.full_name ?? '').trim();
    const who = senderName || (senderRole === 'doctor' ? 'Your doctor' : 'Your patient');
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
    await createNotification(recipientId, 'message', `${who} sent you a message: "${preview}"`, 'info', bookingId);
  } catch {
    // Swallowed on purpose — the message itself is already saved and visible.
  }
}

export function subscribeToMessages(
  bookingId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
) {
  // Single equality filter, sorted client-side — same no-composite-index shape
  // used by every other query in the app.
  const messagesQuery = query(collection(db, 'Messages'), where('booking_id', '==', bookingId));
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            bookingId: String(data.booking_id ?? ''),
            senderId: String(data.sender_id ?? ''),
            senderRole: (data.sender_role === 'doctor' ? 'doctor' : 'patient') as SenderRole,
            text: String(data.message ?? ''),
            sentAt: (data.sent_at as Timestamp | undefined)?.toDate?.() ?? null,
          };
        })
        // Messages still awaiting their server timestamp sort to the end, which
        // is where an optimistic just-sent message belongs anyway.
        .sort((a, b) => (a.sentAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.sentAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
      onChange(messages);
    },
    (error) => onError(error),
  );
}

// The consultation's state comes from two documents: the booking (active / ended and when) and the doctor's written
// note (Consultation_Notes). Each is watched separately and the screen gets one combined state.
export function subscribeToConsultation(
  bookingId: string,
  onChange: (state: ConsultationState) => void,
  onError: (error: Error) => void,
) {
  let state: ConsultationState = { status: 'not_started', summary: '', advice: '', followUpAt: null, endedAt: null };
  const unsubscribeBooking = onSnapshot(
    doc(db, 'Bookings', bookingId),
    (snapshot) => {
      const data = snapshot.data() ?? {};
      state = {
        ...state,
        status: (data.consultation_status ?? 'not_started') as ConsultationStatus,
        endedAt: (data.consultation_ended_at as Timestamp | undefined)?.toDate?.() ?? null,
      };
      onChange(state);
    },
    (error) => onError(error),
  );
  const unsubscribeNote = onSnapshot(
    doc(db, 'Consultation_Notes', bookingId),
    (snapshot) => {
      const data = snapshot.data();
      state = {
        ...state,
        summary: String(data?.summary ?? ''),
        advice: String(data?.advice ?? ''),
        followUpAt: (data?.follow_up_at as Timestamp | null | undefined)?.toDate?.() ?? null,
      };
      onChange(state);
    },
    (error) => onError(error),
  );
  return () => { unsubscribeBooking(); unsubscribeNote(); };
}

// The written note for a booking, as the rules require it (firestore.rules, Consultation_Notes): the booking's ids, the
// Diagnosis notes (summary), the Advice, the Follow-up date or null, and the server's clock. Only the booking's doctor
// can write it.
function noteRecord(bookingId: string, patientId: string, providerId: string, notes: ConsultationNotes) {
  return {
    booking_id: bookingId,
    patient_id: patientId,
    provider_id: providerId,
    summary: notes.summary.trim(),
    advice: notes.advice.trim(),
    follow_up_at: notes.followUpAt ? Timestamp.fromDate(notes.followUpAt) : null,
    updated_at: serverTimestamp(),
  };
}

/**
 * Ends the consultation: the booking becomes `completed` and the chat turns read-only.
 * Either side can end it. The doctor writes the notes while ending (the booking and the note are saved in ONE write);
 * when the PATIENT ends it there are no notes (pass null) and the doctor can add them afterwards.
 */
export async function endConsultation(bookingId: string, notes: ConsultationNotes | null, endedBy: SenderRole) {
  const reference = doc(db, 'Bookings', bookingId);
  const booking = await getDoc(reference);
  const data = booking.data();
  const batch = writeBatch(db);
  batch.update(reference, {
    status: 'completed',
    consultation_status: 'ended',
    consultation_ended_at: serverTimestamp(),
    consultation_ended_by: endedBy,
  });
  const hasNotes = Boolean(notes && (notes.summary.trim() || notes.advice.trim() || notes.followUpAt));
  if (endedBy === 'doctor' && data && notes && hasNotes) {
    batch.set(doc(db, 'Consultation_Notes', bookingId), noteRecord(bookingId, String(data.patient_id ?? ''), String(data.provider_id ?? ''), notes));
  }
  await batch.commit();

  // Tell the other party. Failing to notify must never undo the end itself.
  try {
    if (!data) return;
    const recipientId = endedBy === 'doctor' ? String(data.patient_id ?? '') : String(data.provider_id ?? '');
    if (!recipientId) return;
    const who = endedBy === 'doctor' ? 'Your doctor' : 'Your patient';
    await createNotification(recipientId, 'booking_update', `${who} ended the consultation.`, 'info', bookingId);
  } catch {
    // Swallowed on purpose: the consultation is already ended.
  }
}

/** Lets the doctor write or change the notes after the consultation ended (e.g. the patient ended it). */
export async function saveConsultationNotes(bookingId: string, notes: ConsultationNotes) {
  const data = (await getDoc(doc(db, 'Bookings', bookingId))).data();
  if (!data) throw new Error('This appointment no longer exists.');
  await setDoc(doc(db, 'Consultation_Notes', bookingId), noteRecord(bookingId, String(data.patient_id ?? ''), String(data.provider_id ?? ''), notes));
}
