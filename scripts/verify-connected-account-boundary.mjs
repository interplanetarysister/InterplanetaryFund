import fs from "node:fs";

const source = fs.readFileSync("convex/connectedAccounts.ts", "utf8");

const handlers = [
  "getConnectedAccounts",
  "connectAccount",
  "revokeAccount",
  "verifyAccount",
  "getCampaignAuthorizations",
  "authorizeAccount",
  "revokeAuthorization",
  "checkAuthorization",
];

function bodyOf(name) {
  const marker = `export const ${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing handler: ${name}`);
  const next = source.indexOf("export const ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

for (const name of handlers) {
  const body = bodyOf(name);
  if (!body.includes("requireAuth(ctx)")) {
    throw new Error(`${name}: missing requireAuth(ctx) boundary`);
  }
}

const ownerHandlers = [
  "getConnectedAccounts",
  "connectAccount",
  "revokeAccount",
  "authorizeAccount",
  "revokeAuthorization",
  "checkAuthorization",
];

for (const name of ownerHandlers) {
  const body = bodyOf(name);
  if (!body.includes("identity.subject")) {
    throw new Error(`${name}: missing authenticated identity binding`);
  }
}

for (const name of ["getConnectedAccounts", "connectAccount"]) {
  const body = bodyOf(name);
  if (/args\.userId/.test(body)) {
    throw new Error(`${name}: client-supplied userId remains an authorization/data-selection source`);
  }
}

for (const name of ["revokeAccount", "authorizeAccount", "revokeAuthorization"]) {
  const body = bodyOf(name);
  if (/args\.userId/.test(body) && /=== args\.userId/.test(body)) {
    throw new Error(`${name}: client-supplied userId remains an ownership comparison`);
  }
}

const scopedHandlers = ["verifyAccount", "getCampaignAuthorizations"];
for (const name of scopedHandlers) {
  const body = bodyOf(name);
  if (!body.includes("identity.subject")) {
    throw new Error(`${name}: missing least-privilege identity scope`);
  }
}

console.log("Connected-account identity-boundary guard passed.");
