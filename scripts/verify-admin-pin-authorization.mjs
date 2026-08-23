import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const securitySource = await readFile(
  fileURLToPath(new URL("../convex/security.ts", import.meta.url)),
  "utf8",
);

if (securitySource.includes("0426")) {
  throw new Error("Hardcoded legacy admin PIN detected in the authoritative security module.");
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

  const hasDenialPath = /throw new Error\([^)]*(?:access|restricted|credential|permission)[^)]*\)/i.test(source);
  if (!hasDenialPath) {
    throw new Error(`${name} does not contain an explicit denial path.`);
  }
}

if (!/role === [\"']super_admin[\"']/.test(superAdminSource)) {
  throw new Error("requireSuperAdmin no longer enforces the super_admin role.");
}

if (!permissionSource.includes("permissions.includes(permission)")) {
  throw new Error("requirePermission no longer checks the requested permission.");
}

console.log("Admin PIN authorization regression verification passed.");
