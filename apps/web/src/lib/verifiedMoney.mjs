/**
 * Sum verified integer-cent values without silently replacing missing records
 * with zero. An empty, successfully loaded ledger is an actual zero.
 */
export function sumVerifiedCents(records, field) {
  if (!Array.isArray(records)) return null;
  let total = 0;
  for (const record of records) {
    const amount = record?.[field];
    if (typeof amount !== "number" && typeof amount !== "string") return null;
    if (typeof amount === "string" && !/^(0|[1-9]\d*)$/.test(amount.trim())) return null;
    const cents = Number(amount);
    if (!Number.isSafeInteger(cents) || cents < 0) return null;
    total += cents;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}
