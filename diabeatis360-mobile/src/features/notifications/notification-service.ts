import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

import { db } from '@/firebase';
import { glucoseDirection, interpretGlucose } from '@/constants/glucose';
import type { MealContext } from '@/constants/enums';
import { translate, type Language } from '@/i18n/translate';

export type NotificationType =
  | 'glucose_alert' | 'booking_update' | 'message' | 'reminder' | 'announcement' | 'guardian_verification' | 'doctor_verification';

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

// NOTE: these are safety prompts, not a diagnosis. The cut-offs come from constants/glucose.ts (DECISIONS.md D4).
// Critical readings always tell the person to contact their doctor or seek emergency care (root CLAUDE.md
// health-safety rules); the app never suggests a medication change or an insulin dose.
export function glucoseAlert(readingMgdl: number, context: MealContext, language: Language = 'English'): { message: string; severity: NotificationEntry['severity'] } | null {
  const interpretation = interpretGlucose(readingMgdl, context);
  const say = (key: Parameters<typeof translate>[1]) => translate(language, key, { value: readingMgdl });
  if (interpretation === 'critical') {
    return glucoseDirection(readingMgdl, context) === 'low'
      ? {
          message: say('alert.criticalLow'),
          severity: 'critical',
        }
      : {
          message: say('alert.criticalHigh'),
          severity: 'critical',
        };
  }
  if (interpretation === 'high') {
    return {
      message: say('alert.high'),
      severity: 'warning',
    };
  }
  if (interpretation === 'low') {
    return {
      message: say('alert.low'),
      severity: 'warning',
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

/** "Mark all as read" (Figma P-22): one batched write, so it either all happens or none of it does. */
export async function markAllNotificationsRead(notificationIds: string[]) {
  // A Firestore batch holds at most 500 writes; a person never has that many unread, but split to be safe.
  for (let start = 0; start < notificationIds.length; start += 500) {
    const batch = writeBatch(db);
    for (const id of notificationIds.slice(start, start + 500)) batch.update(doc(db, 'Notifications', id), { is_read: true });
    await batch.commit();
  }
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
