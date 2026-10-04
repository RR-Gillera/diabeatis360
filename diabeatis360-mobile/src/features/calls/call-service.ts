import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';
import { createNotification } from '@/features/notifications/notification-service';

// Video call signaling (DECISIONS.md D11). One document per booking, Calls/{bookingId}, describes the CURRENT call:
//   ringing -> accepted -> ended          (normal call)
//   ringing -> declined | missed | ended  (not answered / cancelled)
// The other person's app listens for a ringing call and shows an incoming-call screen (features/calls/incoming-call-host).
// The video itself is Jitsi, loaded inside the app. Known limitation: it only rings while the app is open; ringing an app
// that is fully closed needs push notifications, which are out of scope.

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended';

export type CallRecord = {
  id: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  /** Random per call. The Jitsi room name comes from THIS, not the booking id (which is guessable). */
  room: string;
  createdAt: Date | null;
};

/** How long the caller waits before the call counts as missed. */
export const RING_TIMEOUT_MS = 30_000;
/** A "ringing" call older than this is a leftover (the caller's app was closed), so the callee ignores it. */
export const STALE_RING_MS = 45_000;

/** The Jitsi room both people join, named after the call's random token. Only the two participants can read it. */
export function videoRoomUrl(room: string, displayName?: string) {
  const name = displayName ? `&userInfo.displayName="${encodeURIComponent(displayName)}"` : '';
  return `https://meet.jit.si/diabeatis360-${room}#config.prejoinPageEnabled=false${name}`;
}

/** 24 random letters and digits (crypto when the platform has it). */
function newRoomToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(24);
  if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

function fromDoc(id: string, data: Record<string, unknown>): CallRecord {
  return {
    id,
    callerId: String(data.caller_id ?? ''),
    calleeId: String(data.callee_id ?? ''),
    status: (data.status ?? 'ended') as CallStatus,
    room: String(data.room ?? ''),
    createdAt: (data.created_at as Timestamp | undefined)?.toDate?.() ?? null,
  };
}

/** A person's display name (doctors live in Providers, everyone else in Users). */
export async function fetchDisplayName(userId: string) {
  const [provider, user] = await Promise.all([getDoc(doc(db, 'Providers', userId)), getDoc(doc(db, 'Users', userId))]);
  return String(provider.data()?.full_name || user.data()?.full_name || 'Diabeatis360 user');
}

/**
 * Rings the other person on this booking. The rules only allow it on a confirmed booking. A leftover call from earlier
 * (the other app was closed) is cleaned up first; a fresh call in either direction is never overwritten.
 */
export async function startCall(bookingId: string, callerId: string) {
  const booking = await getDoc(doc(db, 'Bookings', bookingId));
  const data = booking.data();
  if (!data) throw new Error('This appointment no longer exists.');
  const calleeId = data.patient_id === callerId ? String(data.provider_id) : String(data.patient_id);

  const existing = await getDoc(doc(db, 'Calls', bookingId));
  if (existing.exists()) {
    const call = fromDoc(existing.id, existing.data());
    const age = call.createdAt ? Date.now() - call.createdAt.getTime() : 0;
    if (call.status === 'accepted') await endCall(bookingId);
    else if (call.status === 'ringing') {
      if (age < STALE_RING_MS) throw new Error(call.callerId === callerId ? 'You are already calling. Please wait for an answer.' : 'They are calling you right now. Answer the incoming call instead.');
      if (call.callerId === callerId) await updateDoc(doc(db, 'Calls', bookingId), { status: 'missed', ended_at: serverTimestamp() });
      else await answerCall(bookingId, false);
    }
  }

  await setDoc(doc(db, 'Calls', bookingId), {
    booking_id: bookingId,
    caller_id: callerId,
    callee_id: calleeId,
    status: 'ringing',
    room: newRoomToken(),
    created_at: serverTimestamp(),
    ended_at: null,
  });
  return calleeId;
}

/** The callee answers. */
export function answerCall(bookingId: string, accept: boolean) {
  return updateDoc(doc(db, 'Calls', bookingId), { status: accept ? 'accepted' : 'declined' });
}

/** Either person hangs up (or the caller cancels while it is still ringing). */
export function endCall(bookingId: string) {
  return updateDoc(doc(db, 'Calls', bookingId), { status: 'ended', ended_at: serverTimestamp() });
}

/** Nobody answered in time: mark it missed and leave the callee an in-app note. */
export async function markMissed(bookingId: string, calleeId: string, callerName: string) {
  await updateDoc(doc(db, 'Calls', bookingId), { status: 'missed', ended_at: serverTimestamp() });
  try {
    await createNotification(calleeId, 'booking_update', `Missed video call from ${callerName}.`, 'info', bookingId);
  } catch {
    // The call is already marked missed; failing to leave a note must not undo that.
  }
}

/** Live view of one booking's call (null before the first call). */
export function subscribeToCall(bookingId: string, onChange: (call: CallRecord | null) => void, onError: (error: Error) => void) {
  return onSnapshot(
    doc(db, 'Calls', bookingId),
    (snapshot) => onChange(snapshot.exists() ? fromDoc(snapshot.id, snapshot.data()) : null),
    (error) => onError(error),
  );
}

/** Calls ringing for this person right now. Two equality filters, so no composite index is needed. */
export function subscribeToIncomingCalls(userId: string, onChange: (calls: CallRecord[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(db, 'Calls'), where('callee_id', '==', userId), where('status', '==', 'ringing')),
    (snapshot) => onChange(snapshot.docs.map((document) => fromDoc(document.id, document.data()))),
    (error) => onError(error),
  );
}
