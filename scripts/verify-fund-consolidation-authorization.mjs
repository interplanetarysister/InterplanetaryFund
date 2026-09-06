import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(process.cwd(), "convex/fundConsolidation.ts");
const source = readFileSync(sourcePath, "utf8");

const mutationStart = source.indexOf("export const consolidateFunds = mutation({");
if (mutationStart < 0) {
  throw new Error("consolidateFunds mutation export not found");
}

const mutationBody = source.slice(mutationStart);

const required = [
  ["canonical auth helper", /requireAuth\s*\(\s*ctx\s*\)/],
  ["authenticated subject binding", /identity\.subject/],
  ["campaign owner lookup", /query\(\s*[\"']userCampaigns[\"']\s*\)/],
  ["owner comparison", /campaign\.userId\s*!==\s*(?:identity\.subject|userId)/],
];

const missing = required.filter(([, pattern]) => !pattern.test(mutationBody));
if (missing.length) {
  throw new Error(
    `consolidateFunds authorization boundary is incomplete: ${missing
      .map(([name]) => name)
      .join(", ")}`,
  );
}

if (/campaign\.userId\s*!==\s*args\.userId/.test(mutationBody)) {
  throw new Error(
    "consolidateFunds still authorizes with the client-supplied args.userId; bind authorization to identity.subject instead",
  );
}

console.log("consolidateFunds authorization boundary verified");
