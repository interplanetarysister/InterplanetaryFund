import fs from "node:fs";

const source = fs.readFileSync("convex/userCampaigns.ts", "utf8");

const sensitiveHandlers = [
  "getMyCampaigns",
  "createCampaign",
  "updateCampaign",
  "deleteCampaign",
  "getNotifications",
  "followCampaign",
  "getFollowedCampaigns",
  "unfollowCampaign",
];

function extractExport(name) {
  const marker = `export const ${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing expected export: ${name}`);

  const bodyStart = source.indexOf("handler:", start);
  if (bodyStart < 0) throw new Error(`${name}: missing handler`);

  const braceStart = source.indexOf("{", bodyStart);
  if (braceStart < 0) throw new Error(`${name}: missing handler body`);

  let depth = 0;
  let inString = null;
  let escaped = false;

  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error(`${name}: unterminated handler`);
}

const failures = [];

for (const name of sensitiveHandlers) {
  let block;
  try {
    block = extractExport(name);
  } catch (error) {
    failures.push(error.message);
    continue;
  }

  if (!/requireAuth\s*\(\s*ctx\s*\)/.test(block)) {
    failures.push(`${name}: missing requireAuth(ctx) boundary`);
  }
  if (!/identity\.subject/.test(block)) {
    failures.push(`${name}: missing identity.subject binding`);
  }

  // Authorization must not be derived from a caller-controlled userId.
  if (/args\.userId|userId\s*===\s*campaign\.userId|campaign\.userId\s*===\s*userId/.test(block)) {
    failures.push(`${name}: client-supplied userId appears in authorization logic`);
  }
}

if (failures.length) {
  console.error("User-campaign identity boundary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`User-campaign identity boundary verification passed for ${sensitiveHandlers.length} handlers.`);
