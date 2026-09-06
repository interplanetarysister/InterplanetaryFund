import fs from "node:fs";

const source = fs.readFileSync("convex/fundMigration.ts", "utf8");

function getExportBody(name) {
  const marker = `export const ${name} =`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${name} export`);
  const nextExport = source.indexOf("export const ", start + marker.length);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

const recordMigration = getExportBody("recordMigration");
const getPendingPayouts = getExportBody("getPendingPayouts");
const selectPayoutMethod = getExportBody("selectPayoutMethod");
const getMigrationHistory = getExportBody("getMigrationHistory");
const batchMigrate = getExportBody("batchMigrate");

const failures = [];

function requireAuthenticatedIdentity(body, name) {
  if (!/requireAuth\s*\(/.test(body)) {
    failures.push(`${name} must require authenticated identity`);
  }
  if (!/identity\.subject/.test(body)) {
    failures.push(`${name} must bind authorization to identity.subject`);
  }
}

function requireSubjectOwnershipComparison(body, name) {
  const subjectComparison =
    /(?:userId|ownerId|ownerUserId)\s*(?:===|!==)\s*identity\.subject/.test(body) ||
    /identity\.subject\s*(?:===|!==)\s*[^\n;]*(?:userId|ownerId|ownerUserId)/.test(body) ||
    /\.eq\(\s*["'](?:userId|ownerId|ownerUserId)["']\s*,\s*identity\.subject\s*\)/.test(body);

  if (!subjectComparison) {
    failures.push(`${name} must compare the authenticated subject with the stored owner identity`);
  }
}

requireAuthenticatedIdentity(recordMigration, "recordMigration");
requireAuthenticatedIdentity(getPendingPayouts, "getPendingPayouts");
requireAuthenticatedIdentity(selectPayoutMethod, "selectPayoutMethod");
requireAuthenticatedIdentity(getMigrationHistory, "getMigrationHistory");
requireSubjectOwnershipComparison(getPendingPayouts, "getPendingPayouts");
requireSubjectOwnershipComparison(selectPayoutMethod, "selectPayoutMethod");
requireSubjectOwnershipComparison(getMigrationHistory, "getMigrationHistory");

if (/withdrawnBy\s*:\s*v\.string\(\)/.test(recordMigration)) {
  failures.push("recordMigration must not accept withdrawnBy as an authorization identity from the client");
}

if (/userId:\s*args\.campaignId/.test(recordMigration)) {
  failures.push("recordMigration must not store campaignId as transactions.userId/payoutRequests.userId");
}

if (/status:\s*[\"']completed[\"']/.test(recordMigration)) {
  failures.push("recordMigration must not mark an externally claimed migration completed without provider-verified evidence");
}

if (/ctx\.db\.query\(["']payoutRequests["']\)\.collect\(\)/.test(getPendingPayouts)) {
  failures.push("getPendingPayouts must not collect every payout before applying an owner-scoped database predicate");
}

if (!/internalMutation\s*\(\s*\{/.test(batchMigrate)) {
  failures.push("batchMigrate must remain internal-only");
}

if (/adminPin\s*:\s*v\.|withdrawnBy\s*:\s*v\./.test(batchMigrate)) {
  failures.push("batchMigrate must not accept client credentials or actor identity");
}

if (/userId:\s*migration\.campaignId/.test(batchMigrate)) {
  failures.push("batchMigrate must not store campaignId as payoutRequests.userId");
}

if (/status:\s*["']completed["']/.test(batchMigrate)) {
  failures.push("batchMigrate must not mark externally claimed funds completed without provider verification");
}

if (failures.length) {
  console.error("Fund migration authorization/integrity guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Fund migration authorization/integrity guard passed.");
