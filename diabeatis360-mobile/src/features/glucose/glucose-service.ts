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
