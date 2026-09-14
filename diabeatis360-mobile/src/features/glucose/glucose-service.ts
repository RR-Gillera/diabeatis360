import { addDoc, collection, onSnapshot, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';

import type { GlucoseLogEntry, GlucoseLogRecord, Interpretation, MealContext } from './types';

// TODO: placeholder thresholds, confirm with adviser before treating as clinically
// authoritative. Rough ballpark ADA-style ranges (fasting/before-meal vs. post-meal
// targets differ), not sourced from a vetted clinical reference for this project.
export function getInterpretation(readingMgdl: number, context: MealContext): Interpretation {
  if (readingMgdl < 70) return 'low';
  const highThreshold = context === 'before_meal' ? 130 : 180;
  if (readingMgdl > highThreshold) return 'high';
  return 'normal';
}

export async function addGlucoseLog(patientId: string, readingMgdl: number, context: MealContext, notes: string, loggedAt: Date) {
  const record: GlucoseLogRecord = {
    patient_id: patientId,
    reading_mgdl: readingMgdl,
    context,
    notes: notes.trim(),
    logged_at: Timestamp.fromDate(loggedAt),
    created_at: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'Glucose_Logs'), record);
  return reference.id;
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
            interpretation: getInterpretation(readingMgdl, context),
          };
        })
        .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0));
      onChange(entries);
    },
    (error) => onError(error),
  );
}
