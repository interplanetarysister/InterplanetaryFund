import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/fundConsolidation.ts", import.meta.url), "utf8");
const failures = [];

const mustInclude = [
  "ctx.auth.getUserIdentity()",
  "const authenticatedUserId = identity.subject;",
  "campaign.userId !== authenticatedUserId",
  "CONSOLIDATION_LOCK_PREFIX",
  "acquireCampaignLock(ctx, campaign)",
  "byProviderTxnId",
  "providerTransactionId = donation.txnId || `donation_${donation._id}`",
  "ctx.db.insert(\"providerTransactions\"",
];

for (const fragment of mustInclude) {
  if (!source.includes(fragment)) {
    failures.push(`Missing required consolidation integrity invariant: ${fragment}`);
  }
}

// The legacy userId argument may remain for API compatibility, but the
// effective authorization decision must use the authenticated subject.
if (!source.includes("if (campaign.userId !== authenticatedUserId || suppliedUserId !== authenticatedUserId)")) {
  failures.push("Public consolidation does not fail closed on authenticated owner mismatch.");
}

// Amount/time similarity is not an idempotency boundary.
if (source.includes("existingByAmount") || source.includes("Math.abs(new Date(e.createdAt)")) {
  failures.push("Fuzzy amount/time deduplication remains in the consolidation path.");
}

// Donations must be snapshotted once per campaign, not queried inside an
// authorization loop. This prevents one donation being imported once per
// active authorization.
if (source.includes("for (const auth of authorizations)") && source.includes('query("donations")')) {
  failures.push("Donations are still queried inside an authorization loop.");
}
if (!source.includes('const donations = await ctx.db') || !source.includes('.query("donations")') || !source.includes('for (const donation of donations)')) {
  failures.push("Campaign-level donation snapshot/processing is missing.");
}

// Provider transaction identity must be checked before ledger/provider writes.
const providerLookup = source.indexOf('query("providerTransactions")');
const providerLookupIndex = source.indexOf("byProviderTxnId");
const ledgerInsertIndex = source.indexOf('ctx.db.insert("campaignLedger"');
if (providerLookupIndex < 0 || providerLookup < 0 || providerLookup > providerLookupIndex || providerLookupIndex > ledgerInsertIndex) {
  failures.push("Durable provider transaction lookup is not established before ledger insertion.");
}

if (failures.length) {
  throw new Error(`Fund consolidation integrity guard failed:\n- ${failures.join("\n- ")}`);
}

console.log("Fund consolidation integrity guard passed.");
