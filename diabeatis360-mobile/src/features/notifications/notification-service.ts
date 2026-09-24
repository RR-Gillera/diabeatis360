import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';
import type { Interpretation } from '@/features/glucose/types';

export type NotificationType = 'glucose_alert' | 'booking_update' | 'message' | 'reminder';

export type NotificationEntry = {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  sentAt: Date | null;
  /** Severity drives the colour treatment in the UI. */
  severity: 'info' | 'warning' | 'critical';
  /** What the notification points at — a booking id for message notifications. */
  relatedId: string;
};

type NotificationRecord = {
  user_id: string;
  notification_type: NotificationType;
  message: string;
  severity: NotificationEntry['severity'];
  is_read: boolean;
  related_id: string;
  scheduled_time: ReturnType<typeof serverTimestamp>;
  sent_at: ReturnType<typeof serverTimestamp>;
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  severity: NotificationEntry['severity'] = 'info',
  relatedId = '',
) {
  const record: NotificationRecord = {
    user_id: userId,
    notification_type: type,
    message,
    severity,
    is_read: false,
    related_id: relatedId,
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  };
  await addDoc(collection(db, 'Notifications'), record);
}

// NOTE: these are safety prompts, not a diagnosis — they mirror the same
// placeholder thresholds getInterpretation() uses, which still need the
// adviser's sign-off before being treated as clinically authoritative.
export function glucoseAlert(readingMgdl: number, interpretation: Interpretation): { message: string; severity: NotificationEntry['severity'] } | null {
  if (interpretation === 'high') {
    // Well above the post-meal target is the point where "see someone today"
    // is the honest advice rather than "watch it".
    const urgent = readingMgdl >= 250;
    return {
      message: urgent
        ? `Your reading of ${readingMgdl} mg/dL is very high. Please contact your doctor or go to the nearest hospital now.`
        : `Your reading of ${readingMgdl} mg/dL is above your target range. Consider booking a consultation with your doctor.`,
      severity: urgent ? 'critical' : 'warning',
    };
  }
  if (interpretation === 'low') {
    const urgent = readingMgdl < 54;
    return {
      message: urgent
        ? `Your reading of ${readingMgdl} mg/dL is dangerously low. Take fast-acting sugar now and seek medical help immediately.`
        : `Your reading of ${readingMgdl} mg/dL is below your target range. Have a fast-acting snack and re-check in 15 minutes.`,
      severity: urgent ? 'critical' : 'warning',
    };
  }
  return null;
}

export function subscribeToNotifications(
  userId: string,
  onChange: (entries: NotificationEntry[]) => void,
  onError: (error: Error) => void,
) {
  // Single equality filter, sorted client-side — same no-composite-index shape
  // as the booking and glucose queries.
  const notificationsQuery = query(collection(db, 'Notifications'), where('user_id', '==', userId));
  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const entries = snapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            type: (data.notification_type ?? 'reminder') as NotificationType,
            message: String(data.message ?? ''),
            isRead: Boolean(data.is_read),
            sentAt: (data.sent_at as Timestamp | undefined)?.toDate?.() ?? null,
            severity: (data.severity ?? 'info') as NotificationEntry['severity'],
            relatedId: String(data.related_id ?? ''),
          };
        })
        .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
      onChange(entries);
    },
    (error) => onError(error),
  );
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, 'Notifications', notificationId), { is_read: true });
}

/**
 * Clears the unread message notifications for one conversation. Called when a
 * chat is opened, so reading the messages is what dismisses the badge rather
 * than leaving a pile of stale alerts behind.
 */
export async function markConversationNotificationsRead(userId: string, bookingId: string) {
  const pending = query(collection(db, 'Notifications'), where('user_id', '==', userId), where('related_id', '==', bookingId));
  const snapshot = await getDocs(pending);
  await Promise.all(snapshot.docs.filter((entry) => !entry.data().is_read).map((entry) => updateDoc(entry.ref, { is_read: true })));
}
