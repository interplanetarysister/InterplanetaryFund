import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = fs.readFileSync(path.join(root, "convex", "fundConsolidation.ts"), "utf8");
const failures = [];

function extractQuery(name) {
  const match = target.match(new RegExp(`export const ${name}\\s*=\\s*query\\(\\{[\\s\\S]*?\\n\\}\\);`));
  if (!match) failures.push(`${name} implementation could not be located`);
  return match?.[0] ?? "";
}

if (!/import \{[^}]*requireAuth[^}]*\} from ["']\.\/security["']/.test(target)) {
  failures.push("fundConsolidation.ts must import the canonical requireAuth helper");
}

for (const name of ["getLastConsolidation", "getConsolidationHistory"]) {
  const implementation = extractQuery(name);
  if (!implementation) continue;

  if (!/args:\s*\{\s*campaignId:\s*v\.string\(\)\s*\}/.test(implementation)) {
    failures.push(`${name} must retain only the campaignId query argument`);
  }
  if (!/const identity = await requireAuth\(ctx\)/.test(implementation)) {
    failures.push(`${name} does not require canonical authentication`);
  }
  if (!/identity\.subject/.test(implementation)) {
    failures.push(`${name} does not bind access to the authenticated identity`);
  }
  if (!/userCampaigns/.test(implementation)) {
    failures.push(`${name} does not resolve campaign ownership through userCampaigns`);
  }
  if (!/campaignId/.test(implementation)) {
    failures.push(`${name} does not resolve the requested campaign`);
  }
  if (!/(userId|ownerId)\s*!==?\s*identity\.subject|identity\.subject\s*!==?\s*(campaign\.)?(userId|ownerId)/.test(implementation)) {
    failures.push(`${name} does not explicitly reject a campaign owned by another identity`);
  }
}

if (failures.length) {
  console.error("Consolidation history authorization guard FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Consolidation history authorization guard passed.");
