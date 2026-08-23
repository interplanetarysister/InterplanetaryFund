import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/fundConsolidation.ts", import.meta.url), "utf8");
const failures = [];

// The public mutation may retain the legacy userId argument for API
// compatibility, but it must bind the effective owner to Convex auth and
// compare the campaign owner against that authenticated subject.
if (!/ctx\.auth\.getUserIdentity\(\)/.test(source) || !/authenticatedUserId\s*=\s*identity\.subject/.test(source)) {
  failures.push("consolidateFunds does not bind ownership to the authenticated Convex identity.");
}
if (!/campaign\.userId\s*!==\s*authenticatedUserId/.test(source)) {
  failures.push("consolidateFunds does not enforce campaign ownership against authenticated identity.");
}

// Amount/time similarity is never an idempotency boundary. Existing legacy
// imports may be recognized by their exact deterministic metadata identity,
// while new imports use provider+transaction identity.
if (/existingByAmount\s*=/.test(source) || /Math\.abs\(new Date\(e\.createdAt\)/.test(source)) {
  failures.push("consolidation still relies on fuzzy amount/time matching as a duplicate boundary.");
}
if (!/providerTransactionId\s*=\s*donation\.txnId \|\| `donation_\$\{donation\._id\}`/.test(source)) {
  failures.push("donation imports do not derive a deterministic provider transaction identity when txnId is absent.");
}

// The donation snapshot must be fetched once per campaign, outside any
// authorization iteration, so a donation cannot be imported once per active
// authorization.
if (/for \(const auth of authorizations\)[\s\S]*query\("donations"\)/.test(source)) {
  failures.push("donations are queried inside an authorization loop.");
}
if (!/const donations = await ctx\.db[\s\S]*?query\("donations"\)[\s\S]*?for \(const donation of donations\)/.test(source)) {
  failures.push("donations are not processed from one campaign-level snapshot.");
}

// The campaign document is the transaction-level serialization boundary and
// providerTransactions is the durable provider+transaction record. Both are
// required so retries cannot silently create a second financial entry.
if (!/CONSOLIDATION_LOCK_PREFIX/.test(source) || !/acquireCampaignLock\(ctx, campaign\)/.test(source)) {
  failures.push("campaign-level consolidation serialization/claim boundary is missing.");
}
if (!/query\("providerTransactions"\)[\s\S]*?byProviderTxnId/.test(source)) {
  failures.push("provider transaction idempotency does not consult the durable providerTransactions index.");
}
if (!/ctx\.db\.insert\("providerTransactions"/.test(source)) {
  failures.push("provider transaction claim record is not persisted.");
}

// Every ledger import must carry the same deterministic provider transaction
// identity used by the providerTransactions record.
if (!/providerTransactionId,\n\s*connectedAccountId/.test(source)) {
  failures.push("ledger imports are not explicitly bound to providerTransactionId.");
}

if (failures.length) {
  throw new Error(`Fund consolidation integrity guard failed:\n- ${failures.join("\n- ")}`);
}

console.log("Fund consolidation integrity guard passed.");
