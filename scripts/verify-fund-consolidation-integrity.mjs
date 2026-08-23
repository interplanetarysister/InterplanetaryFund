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

// Donations must be snapshotted once per campaign, not once per authorization.
// Assert a single campaign-level donation query and a single processing loop;
// avoid formatting/scope heuristics that cannot parse nested TypeScript reliably.
const donationQueryMatches = source.match(/const donations = await ctx\.db[\s\S]*?\.query\("donations"\)/g) ?? [];
if (donationQueryMatches.length !== 1) {
  failures.push(`Expected exactly one campaign-level donation query, found ${donationQueryMatches.length}.`);
}
const donationProcessingMatches = source.match(/for \(const donation of donations\)/g) ?? [];
if (donationProcessingMatches.length !== 1) {
  failures.push(`Expected exactly one campaign-level donation processing loop, found ${donationProcessingMatches.length}.`);
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
