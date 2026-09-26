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
  created_at: ReturnType<typeof import('firebase/firestore').serverTimestamp>;
};

export type GlucoseLogEntry = {
  id: string;
  readingMgdl: number;
  context: MealContext;
  notes: string;
  loggedAt: Date | null;
  interpretation: Interpretation;
};
