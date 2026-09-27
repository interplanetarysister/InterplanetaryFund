import fs from "node:fs";

const source = fs.readFileSync("convex/userCampaigns.ts", "utf8");

function getExportBody(name) {
  const marker = `export const ${name} =`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${name} export`);

  const nextExport = source.indexOf("export const ", start + marker.length);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

const payoutHistory = getExportBody("getPayoutHistory");
const pendingPayouts = getExportBody("getPendingPayouts");

const failures = [];

if (/args:\s*\{\s*userId\s*:\s*v\.string\(\)/.test(payoutHistory)) {
  failures.push("getPayoutHistory must not use a client-supplied userId as its authorization boundary");
}

if (!/requireAuth\s*\(/.test(payoutHistory) || !/identity\.subject/.test(payoutHistory)) {
  failures.push("getPayoutHistory must require authenticated identity and bind the read to identity.subject");
}

if (/export const getPendingPayouts\s*=\s*query\s*\(/.test(pendingPayouts)) {
  failures.push("getPendingPayouts must not remain an unrestricted public query");
}

if (!/requirePermission|requireSuperAdmin|requireAuth/.test(pendingPayouts)) {
  failures.push("getPendingPayouts must establish an explicit authenticated/admin authorization boundary");
}

if (failures.length) {
  console.error("Payout read authorization guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Payout read authorization guard passed.");
