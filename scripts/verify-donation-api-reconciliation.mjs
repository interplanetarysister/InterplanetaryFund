import { readFileSync } from "node:fs";

const source = readFileSync("convex/userCampaigns.ts", "utf8");
const generatedApi = readFileSync("convex/_generated/api.d.ts", "utf8");

const exportMatch = source.match(/export\s+const\s+recordDonation\s*=\s*(mutation|internalMutation)\s*\(/s);
const publicExport = exportMatch?.[1] === "mutation";
const generatedModulePresent = /import type \* as userCampaigns from "\.\.\/userCampaigns\.js";/.test(generatedApi);

if (!exportMatch) {
  console.log("recordDonation export is absent from convex/userCampaigns.ts; generated API can be reconciled after Convex codegen.");
  process.exit(0);
}

if (publicExport) {
  throw new Error("recordDonation is still publicly exposed as a Convex mutation; generated API/runtime reconciliation must precede removal or internalization.");
}

if (!generatedModulePresent) {
  throw new Error("Generated Convex API does not contain the userCampaigns module; regenerate code before relying on generated-API reconciliation.");
}

console.log("recordDonation is internal-only; userCampaigns generated API module is present for codegen/runtime reconciliation.");
