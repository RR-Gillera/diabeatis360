import Constants, { ExecutionEnvironment } from 'expo-constants';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/firebase';

import { planReminders } from './reminder-plan';

// Local reminders for the six categories of the Notifications module (glucose check, meal, medication, exercise,
// hydration, appointment). They are scheduled ON THE PHONE with expo-notifications, so they still ring when the app is
// closed and need no server or push service.

const CHANNEL_ID = 'reminders';

type NotificationsModule = typeof import('expo-notifications');
let cached: NotificationsModule | null | undefined;

/**
 * The expo-notifications module, or null where reminders cannot work: the web, and Expo Go on Android (SDK 53
 * removed notification support from Expo Go, and even importing the module fails there). It is loaded only when
 * needed so that failure can never stop the app from starting. A development build has no such limit.
 */
function loadNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === 'web' || (Platform.OS === 'android' && inExpoGo)) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-notifications') as NotificationsModule;
    // Shows a reminder as a banner even while the app is open.
    module.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    cached = module;
  } catch {
    cached = null;
  }
  return cached;
}

/** Confirmed, future appointments of this patient (one equality filter, no composite index). */
async function upcomingAppointments(patientId: string): Promise<Date[]> {
  const snapshot = await getDocs(query(collection(db, 'Bookings'), where('patient_id', '==', patientId)));
  const now = Date.now();
  return snapshot.docs
    .filter((document) => document.data().status === 'confirmed')
    .map((document) => (document.data().scheduled_at as Timestamp | undefined)?.toDate())
    .filter((date): date is Date => Boolean(date) && date!.getTime() > now);
}

/**
 * Makes the phone's scheduled reminders match the plan (every category, D29): cancels the old ones and schedules the new ones.
 * Called when a patient signs in / opens the app, so it always starts from a clean list. Returns how many were
 * scheduled (0 on the web or when permission was refused).
 */
export async function syncReminders(uid: string): Promise<number> {
  const Notifications = loadNotifications();
  if (!Notifications) return 0;

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Health reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }

  const appointments = await upcomingAppointments(uid).catch(() => []);
  const planned = planReminders(appointments);

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of planned) {
    await Notifications.scheduleNotificationAsync({
      content: { title: item.title, body: item.body },
      trigger:
        'hour' in item.when
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: item.when.hour, minute: item.when.minute, channelId: CHANNEL_ID }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.when.date, channelId: CHANNEL_ID },
    });
  }
  return planned.length;
}

/**
 * Whether this phone lets the app show reminders, for Profile > Notifications (D31): 'on', 'off' (refused, or turned
 * off in the phone's settings), or 'unavailable' (the web and Expo Go, where reminders cannot ring). Only reads.
 */
export async function reminderPermission(): Promise<'on' | 'off' | 'unavailable'> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'unavailable';
  try {
    return (await Notifications.getPermissionsAsync()).granted ? 'on' : 'off';
  } catch {
    return 'unavailable';
  }
}

/** Removes every scheduled reminder (used at sign-out so the next person on this phone does not get them). */
export async function clearReminders() {
  await loadNotifications()?.cancelAllScheduledNotificationsAsync();
}
