import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const securitySource = await readFile(
  fileURLToPath(new URL("../convex/security.ts", import.meta.url)),
  "utf8",
);

const forbiddenFallbacks = [
  '?? "0426"',
  "?? '0426'",
  '=== "0426"',
  "=== '0426'",
];

for (const fragment of forbiddenFallbacks) {
  if (securitySource.includes(fragment)) {
    throw new Error(`Hardcoded legacy admin PIN fallback detected: ${fragment}`);
  }
}

const requireSuperAdminStart = securitySource.indexOf("export async function requireSuperAdmin");
const requirePermissionStart = securitySource.indexOf("export async function requirePermission");

if (requireSuperAdminStart === -1 || requirePermissionStart === -1) {
  throw new Error("Expected privileged authorization helpers were not found.");
}

const superAdminSource = securitySource.slice(requireSuperAdminStart, requirePermissionStart);
const permissionSource = securitySource.slice(requirePermissionStart);

for (const [name, source] of [
  ["requireSuperAdmin", superAdminSource],
  ["requirePermission", permissionSource],
]) {
  if (!source.includes("adminUsers")) {
    throw new Error(`${name} no longer checks the authoritative adminUsers table.`);
  }
  if (!source.includes("Access denied") && !source.includes("access is restricted")) {
    throw new Error(`${name} does not contain an explicit denial path.`);
  }
}

console.log("Admin PIN authorization regression verification passed.");
