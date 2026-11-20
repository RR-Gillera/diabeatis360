// Shapes returned by the Cloud Functions in /functions (see functions/lib/prompts.js for how they are produced and
// cleaned). The Figma frames they feed: Meal Details 195:1011, Exercise Details 195:1599, scanner result 195:2908,
// Healthier Alternatives 195:2960.

export type MealSuggestion = {
  name: string;
  tagline: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
  sugar_g: number;
  insight: string;
  ingredients: string[];
};

export type ExerciseSuggestion = {
  name: string;
  tagline: string;
  description: string;
  duration_minutes: number;
  intensity: 'light' | 'moderate';
  benefits: string[];
  caution: string;
};

export type SuggestionKind = 'meal' | 'exercise';

export type RecommendationResult<T> = {
  /** True when a critical reading stopped the suggestions (no AI call was made). */
  blocked: boolean;
  reason?: 'critical';
  message?: string;
  suggestion_id?: string;
  items: T[];
  /** Free-plan generations left today, or null for Premium. */
  remaining: number | null;
};

export type LabelAlternative = { instead_of: string; try: string };

export type LabelAnalysis =
  | { readable: false; message: string; remaining: number | null }
  | {
      readable: true;
      scan_id: string;
      product_name: string;
      brand: string;
      serving_size: string;
      calories: number;
      carbs_g: number;
      sugar_g: number;
      fiber_g: number;
      protein_g: number;
      sodium_mg: number;
      health_rating: 'suitable' | 'caution' | 'unsuitable';
      insight: string;
      allergen_warnings: string[];
      alternatives: LabelAlternative[];
      ingredients_text: string;
      remaining: number | null;
    };

/** A suggestion set saved by the function in AI_Suggestions, read back so details screens need no new AI call. */
export type SavedSuggestion<T> = { id: string; kind: SuggestionKind; items: T[]; generatedAt: Date | null };

// ---- AI Diabetes Risk Prediction (DECISIONS.md D51) -----------------------------------------------------------
// What functions/lib/handlers.js predictRisk returns. The level comes from the fixed rule in functions/lib/risk.js;
// Gemini only writes the advice.
export type RiskLevel = 'low' | 'moderate' | 'high';
export type RiskFactorKey = 'in_range' | 'dangerous' | 'average' | 'trend' | 'activity';
export type RiskFactor = {
  key: RiskFactorKey;
  status: string;
  points: number;
  value: { percent?: number | null; critical?: number; low?: number; mgdl?: number; limit?: number; context?: string; level?: string };
};
export type RiskAssessment = {
  enough: true;
  level: RiskLevel;
  score: number;
  max_score: number;
  factors: RiskFactor[];
  readings_used: number;
  window_days: number;
  diabetes_type: string;
};
export type RiskAdvice = { summary: string; prevention: string[]; correction: string[]; maintenance: string[] };
export type RiskResult =
  | { status: 'ok'; cached: boolean; assessed_at: string; assessment: RiskAssessment; advice: RiskAdvice }
  | { status: 'not_enough'; readings_recent: number; needed: number }
  | { status: 'critical'; message: string; assessment: RiskAssessment | null };
