import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = fs.readFileSync(path.join(root, "convex", "fundConsolidation.ts"), "utf8");

const functionMatch = target.match(/export const getConsolidationSummary\s*=\s*query\(\{[\s\S]*?\n\}\);/);
if (!functionMatch) {
  throw new Error("getConsolidationSummary implementation could not be located");
}

const implementation = functionMatch[0];
const failures = [];

if (/args:\s*\{\s*userId:\s*v\.string\(\)\s*\}/.test(implementation)) {
  failures.push("getConsolidationSummary still accepts a client-supplied userId argument");
}

if (/eq\(\"userId\",\s*userId\)/.test(implementation)) {
  failures.push("getConsolidationSummary still filters ownership using the supplied userId");
}

if (!/requireAuth\(ctx\)/.test(implementation)) {
  failures.push("getConsolidationSummary does not use the canonical requireAuth(ctx) security boundary");
}

if (!/identity\.subject/.test(implementation)) {
  failures.push("getConsolidationSummary does not use the authenticated identity subject for ownership");
}

if (failures.length) {
  console.error("Consolidation summary authorization guard FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Consolidation summary authorization guard passed.");
