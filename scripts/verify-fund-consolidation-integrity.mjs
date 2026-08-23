import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/fundConsolidation.ts", import.meta.url), "utf8");

const failures = [];

// The mutation accepts a caller-supplied userId. It must bind authorization to
// the authenticated identity rather than trusting client input.
if (/export const consolidateFunds = mutation\([\s\S]*?args:\s*\{[\s\S]*?userId:\s*v\.string\(\)/.test(source)) {
  failures.push("consolidateFunds still accepts caller-supplied userId; bind ownership to ctx.auth identity.");
}

// A provider transaction identifier is the authoritative duplicate key. A
// fuzzy amount/time comparison is not a safe substitute for transaction-less
// imports because the same snapshot can be processed by concurrent runs.
if (/existingByAmount\s*=/.test(source) && /Math\.abs\(new Date\(e\.createdAt\)/.test(source)) {
  failures.push("consolidation still relies on fuzzy amount/time matching as a duplicate boundary.");
}

// The implementation currently loops every active authorization while querying
// the same donation set. That pattern must have an explicit per-run claim/dedup
// boundary so one donation cannot be imported once per authorization.
if (/for \(const auth of authorizations\)/.test(source) && /query\("donations"\)/.test(source)) {
  failures.push("donations are queried inside the authorization loop; require a durable per-transaction claim or equivalent per-run dedup boundary.");
}

// providerTransactions should be protected by the same provider+transaction
// identity that protects the ledger entry, not merely by a later audit check.
if (/ctx\.db\.insert\("providerTransactions"/.test(source) && !/providerTransactionId/.test(source)) {
  failures.push("provider transaction writes lack an explicit provider transaction identity guard.");
}

if (failures.length) {
  throw new Error(`Fund consolidation integrity guard failed:\n- ${failures.join("\n- ")}`);
}

console.log("Fund consolidation integrity guard passed.");
