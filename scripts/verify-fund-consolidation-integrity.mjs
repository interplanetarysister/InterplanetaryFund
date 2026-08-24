import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/fundConsolidation.ts", import.meta.url), "utf8");
const failures = [];

const mustInclude = [
  "ctx.auth.getUserIdentity()",
  "const authenticatedUserId = identity.subject;",
  "campaign.userId !== authenticatedUserId",
  "CONSOLIDATION_LOCK_PREFIX",
  "claimAndScheduleConsolidation",
  "internal.fundConsolidation.processConsolidationRun",
  "status: \"claimed\"",
  "byProviderTxnId",
  "providerTransactionId = donation.txnId || `donation_${donation._id}`",
  "ctx.db.insert(\"providerTransactions\"",
];

for (const fragment of mustInclude) {
  if (!source.includes(fragment)) failures.push(`Missing required consolidation integrity invariant: ${fragment}`);
}

if (!source.includes("if (campaign.userId !== authenticatedUserId || suppliedUserId !== authenticatedUserId)")) {
  failures.push("Public consolidation does not fail closed on authenticated owner mismatch.");
}

if (source.includes("existingByAmount") || source.includes("Math.abs(new Date(e.createdAt)")) {
  failures.push("Fuzzy amount/time deduplication remains in the consolidation path.");
}

// A claim must commit before the processing mutation starts. Scheduling from a
// mutation is atomic with the claim transaction and executes after commit.
const claimIndex = source.indexOf("status: \"claimed\"");
const scheduleIndex = source.indexOf("internal.fundConsolidation.processConsolidationRun");
const processIndex = source.indexOf("export const processConsolidationRun = internalMutation");
if (claimIndex < 0 || scheduleIndex < claimIndex || processIndex < 0) {
  failures.push("Consolidation processing is not separated from the committed claim mutation.");
}

// Donations must be snapshotted once per campaign, not once per authorization.
const donationQueryMatches = source.match(/const donations = await ctx\.db[\s\S]*?\.query\("donations"\)/g) ?? [];
if (donationQueryMatches.length !== 1) {
  failures.push(`Expected exactly one campaign-level donation query, found ${donationQueryMatches.length}.`);
}
const donationProcessingMatches = source.match(/for \(const donation of donations\)/g) ?? [];
if (donationProcessingMatches.length !== 1) {
  failures.push(`Expected exactly one campaign-level donation processing loop, found ${donationProcessingMatches.length}.`);
}

// Provider transaction identity must be checked before financial inserts.
const providerLookupIndex = source.indexOf("byProviderTxnId");
const ledgerInsertIndex = source.indexOf('ctx.db.insert("campaignLedger"');
if (providerLookupIndex < 0 || ledgerInsertIndex < 0 || providerLookupIndex > ledgerInsertIndex) {
  failures.push("Provider transaction lookup is not established before ledger insertion.");
}

// The old in-transaction campaign lock must not be the only claim boundary.
if (source.includes("await acquireCampaignLock(ctx, campaign)")) {
  failures.push("Legacy in-transaction campaign lock is still used as the processing claim.");
}

if (failures.length) throw new Error(`Fund consolidation integrity guard failed:\n- ${failures.join("\n- ")}`);
console.log("Fund consolidation integrity guard passed.");
