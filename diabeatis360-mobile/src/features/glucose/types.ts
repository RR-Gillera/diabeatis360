import type { Timestamp } from 'firebase/firestore';

import type { Interpretation, MealContext } from '@/constants/enums';

// Defined in constants/enums.ts (DECISIONS.md D6); re-exported for existing imports.
export type { Interpretation, MealContext };

export type GlucoseLogRecord = {
  patient_id: string;
  reading_mgdl: number;
  context: MealContext;
  notes: string;
  logged_at: Timestamp;
  interpretation: Interpretation;
  created_at: ReturnType<typeof import('firebase/firestore').serverTimestamp>;
};

export type GlucoseLogEntry = {
  id: string;
  readingMgdl: number;
  context: MealContext;
  notes: string;
  loggedAt: Date | null;
  interpretation: Interpretation;
  /** How many times the reading was changed after it was logged (Glucose_Logs.edit_count, D44); 0 if never. */
  editCount: number;
};

/** One change to a reading: what it said before and after, and when (Glucose_Logs/{id}/Edits/{number}, D44). */
export type GlucoseEdit = {
  number: number;
  previousReadingMgdl: number;
  previousContext: MealContext;
  previousNotes: string;
  readingMgdl: number;
  context: MealContext;
  notes: string;
  editedAt: Date | null;
};
