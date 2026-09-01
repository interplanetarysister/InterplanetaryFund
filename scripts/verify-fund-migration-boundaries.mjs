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

const failures = [];

function requireAuthenticatedIdentity(body, name) {
  if (!/requireAuth\s*\(/.test(body)) {
    failures.push(`${name} must require authenticated identity`);
  }
  if (!/identity\.subject/.test(body)) {
    failures.push(`${name} must bind authorization to identity.subject`);
  }
}

requireAuthenticatedIdentity(recordMigration, "recordMigration");
requireAuthenticatedIdentity(getPendingPayouts, "getPendingPayouts");
requireAuthenticatedIdentity(selectPayoutMethod, "selectPayoutMethod");
requireAuthenticatedIdentity(getMigrationHistory, "getMigrationHistory");

if (/withdrawnBy\s*:\s*v\.string\(\)/.test(recordMigration)) {
  failures.push("recordMigration must not accept withdrawnBy as an authorization identity from the client");
}

if (/userId:\s*args\.campaignId/.test(recordMigration)) {
  failures.push("recordMigration must not store campaignId as transactions.userId/payoutRequests.userId");
}

if (/status:\s*[\"']completed[\"']/.test(recordMigration)) {
  failures.push("recordMigration must not mark an externally claimed migration completed without provider-verified evidence");
}

if (/campaignId:\s*v\.optional\(v\.string\(\)\)/.test(getPendingPayouts) && !/identity\.subject/.test(getPendingPayouts)) {
  failures.push("getPendingPayouts must not use an optional client campaignId without authenticated ownership binding");
}

if (!/payout\.userId/.test(selectPayoutMethod) && !/campaign\.userId/.test(selectPayoutMethod)) {
  failures.push("selectPayoutMethod must verify payout ownership server-side before mutation");
}

if (/args\.campaignId/.test(getMigrationHistory) && !/identity\.subject/.test(getMigrationHistory)) {
  failures.push("getMigrationHistory must not authorize campaign history from a client-supplied campaignId alone");
}

if (failures.length) {
  console.error("Fund migration authorization/integrity guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Fund migration authorization/integrity guard passed.");
