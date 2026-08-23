import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const readRepoFile = async (relativePath) =>
  readFile(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const securitySource = await readRepoFile("../convex/security.ts");
const authSource = await readRepoFile("../convex/auth.ts");

if (securitySource.includes("0426") || authSource.includes("0426")) {
  throw new Error("Hardcoded legacy admin PIN detected in the authoritative authorization modules.");
}

if (authSource.includes("DEFAULT_ADMIN_PIN") || authSource.includes("?? DEFAULT_ADMIN_PIN")) {
  throw new Error("Admin PIN verification still contains a hardcoded/default credential fallback.");
}

const verifyPinStart = authSource.indexOf("export const verifyAdminPin");
const updatePinStart = authSource.indexOf("export const updateAdminPin");
if (verifyPinStart === -1 || updatePinStart === -1) {
  throw new Error("Expected admin PIN verification/update functions were not found.");
}

const verifyPinSource = authSource.slice(verifyPinStart, updatePinStart);
const updatePinSource = authSource.slice(updatePinStart);

if (!verifyPinSource.includes("if (!settings?.adminPin)")) {
  throw new Error("verifyAdminPin must fail closed when no configured admin PIN exists.");
}

if (!verifyPinSource.includes("return { valid: false }")) {
  throw new Error("verifyAdminPin does not have an explicit unconfigured denial path.");
}

if (!updatePinSource.includes("if (!settings?.adminPin)")) {
  throw new Error("updateAdminPin must reject first-time updates through the public mutation.");
}

if (!updatePinSource.includes('"Admin PIN is not configured"')) {
  throw new Error("updateAdminPin does not explicitly reject an unconfigured PIN state.");
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
