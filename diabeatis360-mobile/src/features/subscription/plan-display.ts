// How the Premium plans are named and priced on screen (Figma P-30 to P-32). No imports on purpose, so plain Node can
// test it (plan-display.test.mjs). The plans themselves come from Subscription_Plans (DECISIONS D5).

/** "Monthly / month", "6 Months / 6 months", "Yearly / year", from the plan's length. */
export function planLabel(durationDays: number) {
  if (durationDays <= 31) return { name: 'Monthly', unit: '/ month' };
  if (durationDays <= 186) return { name: '6 Months', unit: '/ 6 months' };
  if (durationDays <= 366) return { name: 'Yearly', unit: '/ year' };
  return { name: `${durationDays} days`, unit: `/ ${durationDays} days` };
}

/**
 * How much cheaper a longer plan is than paying monthly for the same time, rounded: ₱499 for 6 months against ₱99 a
 * month is "16"; ₱899 a year is "24". null for the monthly plan itself, or when it is not cheaper.
 */
export function savingsPercent(price: number, durationDays: number, monthlyPrice: number | null) {
  if (!monthlyPrice || durationDays <= 31) return null;
  const months = Math.round(durationDays / 30.4);
  const full = monthlyPrice * months;
  if (full <= 0 || price >= full) return null;
  return Math.round((1 - price / full) * 100);
}

/** ₱899.00 */
export function peso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ₱899 (no centavos when there are none). */
export function pesoShort(amount: number) {
  return Number.isInteger(amount) ? `₱${amount.toLocaleString('en-PH')}` : peso(amount);
}
