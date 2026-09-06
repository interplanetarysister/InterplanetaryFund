import fs from "node:fs";

const source = fs.readFileSync("convex/userCampaigns.ts", "utf8");
const marker = "export const getActiveCampaigns = query({";
const start = source.indexOf(marker);
if (start === -1) throw new Error("getActiveCampaigns export not found");

const nextExport = source.indexOf("export const ", start + marker.length);
const body = source.slice(start, nextExport === -1 ? source.length : nextExport);

if (/ownerName\s*:\s*c\.userId\b/.test(body)) {
  throw new Error("getActiveCampaigns exposes the internal campaign owner/user identifier as ownerName");
}

if (/ownerName\s*:/.test(body) && !/ownerName\s*:\s*(?!c\.userId\b)/.test(body)) {
  throw new Error("getActiveCampaigns ownerName contract requires review; do not expose a raw user identifier");
}

console.log("PASS: getActiveCampaigns does not expose ownerName as c.userId");
