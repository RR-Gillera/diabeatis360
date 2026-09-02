import type { Timestamp } from 'firebase/firestore';

export type MealContext = 'before_meal' | 'after_meal';

export type Interpretation = 'low' | 'normal' | 'high';

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
