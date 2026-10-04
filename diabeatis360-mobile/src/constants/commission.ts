// Platform commission on each consultation (DECISIONS.md D3, closed 2026-09-26): 15% of the doctor's fee.
// It is written on the booking when it is created, so a later rate change never rewrites past revenue.
// firestore.rules checks the same 0.15, so change both together (and get the adviser's OK).
export const PLATFORM_COMMISSION_RATE = 0.15;

/** Commission for a fee, rounded to the centavo. */
export function platformCommission(fee: number) {
  return Math.round(fee * PLATFORM_COMMISSION_RATE * 100) / 100;
}
