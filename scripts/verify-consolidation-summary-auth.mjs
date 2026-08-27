import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = fs.readFileSync(path.join(root, "convex", "fundConsolidation.ts"), "utf8");
const functionMatch = target.match(/export const getConsolidationSummary\s*=\s*query\(\{[\s\S]*?\n\}\);/);
if (!functionMatch) throw new Error("getConsolidationSummary implementation could not be located");

const implementation = functionMatch[0];
const failures = [];

if (/args:\s*\{\s*userId:\s*v\.string\(\)\s*\}/.test(implementation)) {
  failures.push("getConsolidationSummary still accepts a client-supplied userId argument");
}

// The implementation intentionally queries userCampaigns by the authenticated
// subject. This is not a client-supplied ownership value. Reject only an
// argument-derived userId reference inside this query boundary.
if (/args[\s\S]{0,250}?userId/.test(implementation)) {
  failures.push("getConsolidationSummary appears to derive ownership from query arguments");
}

if (!/const identity = await requireAuth\(ctx\)/.test(implementation)) {
  failures.push("getConsolidationSummary does not use the canonical requireAuth(ctx) security boundary");
}

if (!/const userId = identity\.subject/.test(implementation)) {
  failures.push("getConsolidationSummary does not bind ownership to the authenticated identity subject");
}

if (failures.length) {
  console.error("Consolidation summary authorization guard FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Consolidation summary authorization guard passed.");
