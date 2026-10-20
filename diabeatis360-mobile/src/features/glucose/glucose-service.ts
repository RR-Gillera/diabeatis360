import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';
import { checkReading, interpretGlucose } from '@/constants/glucose';
import { createNotification, glucoseAlert } from '@/features/notifications/notification-service';

import { doctorCriticalAlert } from './doctor-alert';
import type { GlucoseLogEntry, GlucoseLogRecord, MealContext } from './types';

// Impossible values (outside 20-600 mg/dL, or decimals) never reach Firestore (DECISIONS.md D25); the rules refuse them too.
function assertPossibleReading(readingMgdl: number) {
  const check = checkReading(readingMgdl);
  if (!check.ok) throw new Error(check.message);
}

/**
 * A critical reading is also sent to the patient's doctors (DECISIONS.md D28): every doctor the patient shares their
 * readings with (a Care_Links document, made when they booked that doctor, D22), so exactly the doctors who can already
 * see this reading. Each notification is tagged with the booking behind the share, which is what firestore.rules require
 * to notify the other person on a booking. Returns how many doctors were reached; it never throws.
 */
async function notifyDoctorsOfCriticalReading(patientId: string, readingMgdl: number, context: MealContext, loggedAt: Date) {
  try {
    const [links, profile] = await Promise.all([
      getDocs(query(collection(db, 'Care_Links'), where('patient_id', '==', patientId))),
      getDoc(doc(db, 'Users', patientId)),
    ]);
    const message = doctorCriticalAlert(String(profile.data()?.full_name ?? ''), readingMgdl, context, loggedAt);
    if (!message) return 0;
    const sent = await Promise.allSettled(links.docs.map((link) => createNotification(
      String(link.data().provider_id), 'glucose_alert', message, 'critical', String(link.data().booking_id),
    )));
    return sent.filter((result) => result.status === 'fulfilled').length;
  } catch {
    return 0; // the reading is saved and the patient's own alert stands; the doctors simply are not told
  }
}

/** Saves a new reading. `doctorsNotified` is how many doctors were sent a critical-reading alert (0 unless critical). */
export async function addGlucoseLog(patientId: string, readingMgdl: number, context: MealContext, notes: string, loggedAt: Date) {
  assertPossibleReading(readingMgdl);
  const record: GlucoseLogRecord = {
    patient_id: patientId,
    reading_mgdl: readingMgdl,
    context,
    notes: notes.trim(),
    logged_at: Timestamp.fromDate(loggedAt),
    interpretation: interpretGlucose(readingMgdl, context),
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Glucose_Logs'), record);

  // A reading outside the target range raises a real notification, so the
  // patient still gets told to see a doctor even if they leave the result
  // screen immediately. Failing to notify must never fail the log itself.
  const alert = glucoseAlert(readingMgdl, context);
  if (alert) {
    try {
      await createNotification(patientId, 'glucose_alert', alert.message, alert.severity);
    } catch {
      // Swallowed on purpose: the reading is saved and the on-screen result
      // still shows the same warning.
    }
  }
  const doctorsNotified = record.interpretation === 'critical'
    ? await notifyDoctorsOfCriticalReading(patientId, readingMgdl, context, loggedAt)
    : 0;
  return { id: reference.id, doctorsNotified };
}

// Editing a reading deliberately does NOT re-fire a glucose alert: the patient
// is correcting a typo they are already looking at, and re-notifying them about
// their own edit would be noise.
export async function updateGlucoseLog(logId: string, readingMgdl: number, context: MealContext, notes: string) {
  assertPossibleReading(readingMgdl);
  await updateDoc(doc(db, 'Glucose_Logs', logId), {
    reading_mgdl: readingMgdl,
    context,
    notes: notes.trim(),
    interpretation: interpretGlucose(readingMgdl, context),
  });
}

export async function deleteGlucoseLog(logId: string) {
  await deleteDoc(doc(db, 'Glucose_Logs', logId));
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Buckets this calendar week's (Mon–Sun) entries by day, averaging same-day
// readings — days with no reading stay null so charts leave them out rather
// than fabricating a value. Shared by the patient's Log tab and the doctor's
// patient-detail view so both read the same week the same way.
export function bucketCurrentWeek(entries: GlucoseLogEntry[]) {
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = WEEKDAY_LABELS.map((label, index) => {
    const dayStart = new Date(monday); dayStart.setDate(monday.getDate() + index);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
    const dayEntries = entries.filter((entry) => entry.loggedAt && entry.loggedAt >= dayStart && entry.loggedAt < dayEnd);
    const value = dayEntries.length ? Math.round(dayEntries.reduce((sum, entry) => sum + entry.readingMgdl, 0) / dayEntries.length) : null;
    return { label, value };
  });
  const weekEnd = new Date(monday); weekEnd.setDate(monday.getDate() + 7);
  const weekEntries = entries.filter((entry) => entry.loggedAt && entry.loggedAt >= monday && entry.loggedAt < weekEnd);
  const average = weekEntries.length ? Math.round(weekEntries.reduce((sum, entry) => sum + entry.readingMgdl, 0) / weekEntries.length) : null;
  return { days, average };
}

// Single equality filter only, sorted client-side — matches the no-composite-index
// convention already used by subscribeToBookingHistory in the booking feature.
export function subscribeToGlucoseHistory(
  patientId: string,
  onChange: (entries: GlucoseLogEntry[]) => void,
  onError: (error: Error) => void,
) {
  const logsQuery = query(collection(db, 'Glucose_Logs'), where('patient_id', '==', patientId));
  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const entries = snapshot.docs
        .map((document) => {
          const data = document.data();
          const readingMgdl = Number(data.reading_mgdl ?? 0);
          const context = (data.context === 'after_meal' ? 'after_meal' : 'before_meal') as MealContext;
          return {
            id: document.id,
            readingMgdl,
            context,
            notes: String(data.notes ?? ''),
            loggedAt: (data.logged_at as Timestamp | undefined)?.toDate() ?? null,
            interpretation: interpretGlucose(readingMgdl, context),
          };
        })
        .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0));
      onChange(entries);
    },
    (error) => onError(error),
  );
}
