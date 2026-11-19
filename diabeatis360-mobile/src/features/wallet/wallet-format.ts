// Pure helpers for the doctor's wallet screen (DECISIONS.md D47). No Firebase here, so `npm test` checks them.
// The server (functions/lib/wallet.js) checks the same limits again; these only give the friendly message first.

/** "₱425.00", "−₱75.00": a minus sign before the peso sign, never "₱-75.00". */
export function formatPeso(value: number) {
  const text = `₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value < 0 ? `−${text}` : text;
}

/** "+₱500.00" for money in, "−₱75.00" for money out (the history rows). */
export function formatSignedPeso(value: number) {
  return value > 0 ? `+${formatPeso(value)}` : formatPeso(value);
}

/** What the doctor typed, as pesos, or NaN. Commas are allowed ("1,000.50"); anything else that is not a number is NaN. */
export function parseAmount(text: string) {
  const cleaned = text.replace(/,/g, '').trim();
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export type AmountProblem = 'invalid' | 'tooHigh' | 'overBalance' | null;

/** Why an amount cannot be sent, or null. `balance` is given only for a withdrawal, which may not go below ₱0. */
export function amountProblem(amount: number, max: number, balance?: number): AmountProblem {
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) return 'invalid';
  if (amount > max) return 'tooHigh';
  if (balance !== undefined && amount > balance) return 'overBalance';
  return null;
}
