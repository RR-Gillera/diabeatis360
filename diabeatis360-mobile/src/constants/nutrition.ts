// Display cues for the nutrition scanner result (Figma 195:2908). These only decide what is HIGHLIGHTED on screen;
// the actual judgement ("suitable / caution / unsuitable") comes from the AI and is checked against the user's allergens.

/** Common reference intake printed on nutrition labels; used for the "% of daily target" ring. */
export const DAILY_CALORIE_REFERENCE = 2000;

/**
 * A serving with this much sugar (grams) is shown in red. The WHO suggests keeping free sugars under about 25 g a day,
 * so 10 g in a single serving is a large share of that. Confirm or change with the adviser / a nutritionist.
 */
export const HIGH_SUGAR_PER_SERVING_G = 10;
