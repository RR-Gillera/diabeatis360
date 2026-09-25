import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';
import { createNotification } from '@/features/notifications/notification-service';

export type SenderRole = 'patient' | 'doctor';

export type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
  sentAt: Date | null;
};

export type ConsultationStatus = 'not_started' | 'active' | 'ended';

export type ConsultationState = {
  status: ConsultationStatus;
  summary: string;
  endedAt: Date | null;
};

/**
 * Deterministic video room for a booking. Both sides derive the same name from
 * the booking ID, so nobody has to send a link — and because Firestore IDs are
 * 20 random characters, the room is effectively unguessable by outsiders.
 */
export function videoRoomUrl(bookingId: string) {
  return `https://meet.jit.si/diabeatis360-${bookingId}`;
}

// Messages live in their own flat collection keyed by booking_id, matching the
// ERD's convention of plain-string foreign keys rather than subcollections.
// Consultation state (active/ended + summary) lives on the Bookings doc itself,
// since the booking IS the consultation — no extra collection needed for it.
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

export function subscribeToConsultation(
  bookingId: string,
  onChange: (state: ConsultationState) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'Bookings', bookingId),
    (snapshot) => {
      const data = snapshot.data() ?? {};
      onChange({
        status: (data.consultation_status ?? 'not_started') as ConsultationStatus,
        summary: String(data.consultation_summary ?? ''),
        endedAt: (data.consultation_ended_at as Timestamp | undefined)?.toDate?.() ?? null,
      });
    },
    (error) => onError(error),
  );
}

/** Ends the consultation and records the doctor's written summary. */
export async function endConsultation(bookingId: string, summary: string) {
  await setDoc(doc(db, 'Bookings', bookingId), {
    consultation_status: 'ended',
    consultation_summary: summary.trim(),
    consultation_ended_at: serverTimestamp(),
  }, { merge: true });
}
