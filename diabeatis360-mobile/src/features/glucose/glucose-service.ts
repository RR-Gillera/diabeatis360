import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';

import { db } from '@/firebase';
import { checkReading, interpretGlucose } from '@/constants/glucose';
import { INTERPRETATIONS, type Interpretation } from '@/constants/enums';
import { requestFamilyAlert } from '@/features/family/family-service';
import { createNotification, glucoseAlert } from '@/features/notifications/notification-service';

import { doctorCriticalAlert } from './doctor-alert';
import type { Language } from '@/i18n/translate';
import type { GlucoseEdit, GlucoseLogEntry, GlucoseLogRecord, MealContext } from './types';

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

/**
 * Saves a new reading, classified for the person's diabetes type (D40: prediabetes uses the ranges for people without
 * diabetes). `doctorsNotified` is how many doctors were sent a critical-reading alert (0 unless critical).
 */
export async function addGlucoseLog(patientId: string, readingMgdl: number, context: MealContext, notes: string, loggedAt: Date, language: Language = 'English', diabetesType = '') {
  assertPossibleReading(readingMgdl);
  const record: GlucoseLogRecord = {
    patient_id: patientId,
    reading_mgdl: readingMgdl,
    context,
    notes: notes.trim(),
    logged_at: Timestamp.fromDate(loggedAt),
    interpretation: interpretGlucose(readingMgdl, context, diabetesType),
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Glucose_Logs'), record);

  // A critical reading also texts the patient's family contacts (D45). Started first and never awaited: the result
  // screen and its Call 911 must not wait for a text message. The server re-checks the reading and decides.
  if (record.interpretation === 'critical') void requestFamilyAlert(reference.id);

  // A reading outside the target range raises a real notification, so the
  // patient still gets told to see a doctor even if they leave the result
  // screen immediately. Failing to notify must never fail the log itself.
  // The patient's own alert is written in their language (D33); the doctor's alert stays English (doctor-alert.ts).
  const alert = glucoseAlert(readingMgdl, context, language, record.interpretation);
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

/**
 * Changes a reading and keeps a record of the change (DECISIONS.md D44).
 *
 * Every change lands in Glucose_Logs/{logId}/Edits/{n}: the values before and after, and the SERVER's time of the
 * edit. Both writes go in one batch, and firestore.rules refuse a change to the reading, meal context or notes that
 * does not leave its matching record, so the history cannot be skipped, rewritten or erased. That is what lets a
 * doctor trust a reading: if 280 was later changed to 120, the doctor sees both numbers and when it happened.
 *
 * Saving without changing anything writes nothing (no empty history entries).
 * Editing deliberately does NOT re-fire a glucose alert: the patient is correcting a reading they are already looking
 * at, and re-notifying them about their own edit would be noise.
 */
export async function updateGlucoseLog(logId: string, readingMgdl: number, context: MealContext, notes: string, diabetesType = '') {
  assertPossibleReading(readingMgdl);
  const logRef = doc(db, 'Glucose_Logs', logId);
  // Read from the phone's cache when offline, so an edit made offline still queues like a new reading does (D-17).
  const current = (await getDoc(logRef)).data();
  if (!current) throw new Error('This reading no longer exists.');

  // The stored values exactly as they are (not tidied up for display), because the rules compare them to the record.
  const before = {
    reading_mgdl: current.reading_mgdl,
    context: String(current.context ?? 'before_meal'),
    notes: String(current.notes ?? ''),
  };
  const after = { reading_mgdl: readingMgdl, context, notes: notes.trim() };
  if (before.reading_mgdl === after.reading_mgdl && before.context === after.context && before.notes === after.notes) return;

  // Records are numbered 1, 2, 3… so the rules can tell which record belongs to which edit.
  const editNumber = Number(current.edit_count ?? 0) + 1;
  const batch = writeBatch(db);
  batch.update(logRef, {
    ...after,
    interpretation: interpretGlucose(readingMgdl, context, diabetesType),
    edit_count: editNumber,
  });
  batch.set(doc(db, 'Glucose_Logs', logId, 'Edits', String(editNumber)), {
    previous_reading_mgdl: before.reading_mgdl,
    previous_context: before.context,
    previous_notes: before.notes,
    ...after,
    edited_at: serverTimestamp(),
  });
  await batch.commit();
}

/** Deletes a reading together with its edit history, in one batch (the rules only allow deleting history that way). */
export async function deleteGlucoseLog(logId: string) {
  const edits = await getDocs(collection(db, 'Glucose_Logs', logId, 'Edits'));
  const batch = writeBatch(db);
  edits.docs.forEach((edit) => batch.delete(edit.ref));
  batch.delete(doc(db, 'Glucose_Logs', logId));
  await batch.commit();
}

/** A reading's edit history, oldest first. Readable by exactly the people who can read the reading itself. */
export function subscribeToEditHistory(
  logId: string,
  onChange: (edits: GlucoseEdit[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'Glucose_Logs', logId, 'Edits'),
    (snapshot) => {
      const edits = snapshot.docs
        .map((document) => {
          // 'estimate': an edit made a moment ago on this phone still waits for the server's time; show the phone's guess.
          const data = document.data({ serverTimestamps: 'estimate' });
          return {
            number: Number(document.id),
            previousReadingMgdl: Number(data.previous_reading_mgdl ?? 0),
            previousContext: (data.previous_context === 'after_meal' ? 'after_meal' : 'before_meal') as MealContext,
            previousNotes: String(data.previous_notes ?? ''),
            readingMgdl: Number(data.reading_mgdl ?? 0),
            context: (data.context === 'after_meal' ? 'after_meal' : 'before_meal') as MealContext,
            notes: String(data.notes ?? ''),
            editedAt: (data.edited_at as Timestamp | undefined)?.toDate?.() ?? null,
          };
        })
        .sort((a, b) => a.number - b.number);
      onChange(edits);
    },
    (error) => onError(error),
  );
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
// Each reading shows the class saved with it, which was worked out for the person's diabetes type when it was saved
// (D40), so a doctor sees the same class as the patient. An old reading saved without one is classified now (D4 targets).
const savedClass = (value: unknown): Interpretation | null => ((INTERPRETATIONS as readonly string[]).includes(String(value)) ? (value as Interpretation) : null);
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
            interpretation: savedClass(data.interpretation) ?? interpretGlucose(readingMgdl, context),
            editCount: Number(data.edit_count ?? 0),
          };
        })
        .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0));
      onChange(entries);
    },
    (error) => onError(error),
  );
}
