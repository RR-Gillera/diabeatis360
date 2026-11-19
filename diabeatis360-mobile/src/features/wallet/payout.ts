// The doctor's saved payout account (DECISIONS.md D47, "My Wallet" and "Withdraw funds" frames). Pure helpers with no
// Firebase, so `npm test` checks them. firestore.rules checks the same bank list and limits again.
//
// Only the LAST 4 DIGITS of the account number are kept: enough to show "BDO •••• 4821" so the doctor can see which
// account they chose, without storing a full bank number. Payouts are a demo (D26): no real money is sent.

/** The banks a doctor can choose. Keep in step with the list in firestore.rules (Payout_Accounts). */
export const PAYOUT_BANKS = ['BDO', 'BPI', 'Metrobank', 'Land Bank', 'UnionBank', 'Security Bank', 'PNB', 'RCBC', 'China Bank'] as const;

export type PayoutKind = 'bank' | 'gcash';

export type PayoutAccount = {
  kind: PayoutKind;
  /** The bank's name, or "GCash". */
  provider: string;
  accountName: string;
  last4: string;
};

/** "BDO •••• 4821" (the server writes the same text on each withdrawal, functions/lib/wallet.js). */
export function payoutLabel(account: Pick<PayoutAccount, 'provider' | 'last4'>) {
  return `${account.provider} •••• ${account.last4}`;
}

/** The typed number without spaces or dashes ("0917 123-4567" -> "09171234567"). */
export function cleanAccountNumber(text: string) {
  return text.replace(/[\s-]/g, '');
}

export type PayoutProblem = 'provider' | 'name' | 'number' | null;

/** Why the form cannot be saved, or null. A bank number is 10 to 16 digits; a GCash number is 09 plus 9 digits. */
export function payoutProblem(kind: PayoutKind, provider: string, accountName: string, numberText: string): PayoutProblem {
  const knownProvider = kind === 'gcash' ? provider === 'GCash' : (PAYOUT_BANKS as readonly string[]).includes(provider);
  if (!knownProvider) return 'provider';
  const name = accountName.trim();
  if (name.length < 2 || name.length > 80) return 'name';
  const digits = cleanAccountNumber(numberText);
  const validNumber = kind === 'gcash' ? /^09\d{9}$/.test(digits) : /^\d{10,16}$/.test(digits);
  return validNumber ? null : 'number';
}

/** The only part of the number that is saved. */
export function lastFour(numberText: string) {
  return cleanAccountNumber(numberText).slice(-4);
}
