import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = fs.readFileSync(path.join(root, "convex", "fundConsolidation.ts"), "utf8");
const functionMatch = target.match(/export const getConsolidationSummary\s*=\s*query\(\{[\s\S]*?\n\}\);/);
if (!functionMatch) throw new Error("getConsolidationSummary implementation could not be located");

const implementation = functionMatch[0];
const failures = [];

if (!/args:\s*\{\s*\}/.test(implementation)) {
  failures.push("getConsolidationSummary must declare an empty argument object");
}
if (/args:\s*\{[\s\S]*?userId\s*:/.test(implementation)) {
  failures.push("getConsolidationSummary still declares a client-supplied userId argument");
}
if (/handler:\s*async\s*\(ctx\s*,\s*\{[\s\S]*?userId/.test(implementation)) {
  failures.push("getConsolidationSummary still destructures userId from query arguments");
}
if (/args\.userId/.test(implementation)) {
  failures.push("getConsolidationSummary still reads args.userId");
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
