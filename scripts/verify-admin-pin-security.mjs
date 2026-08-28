import fs from "node:fs";

const auth = fs.readFileSync("convex/auth.ts", "utf8");
const security = fs.readFileSync("convex/security.ts", "utf8");

const failures = [];

if (!/export const verifyAdminPin = internalQuery\(/.test(auth)) {
  failures.push("verifyAdminPin must be internal-only");
}
if (/DEFAULT_ADMIN_PIN\s*=\s*[\"']0426[\"']/.test(auth)) {
  failures.push("auth.ts must not contain a hardcoded default admin PIN");
}
if (/adminPin\s*=\s*settings\?\.adminPin\s*\?\?\s*[\"']0426[\"']/.test(auth)) {
  failures.push("auth.ts must not fall back to the legacy 0426 PIN");
}
if (!/const adminPin = settings\?\.adminPin;/.test(auth)) {
  failures.push("auth.ts must read the configured PIN without a fallback");
}
if (!/requireAuth\(ctx\)/.test(auth)) {
  failures.push("updateAdminPin must require authenticated identity");
}
if (!/export async function requireSuperAdmin[\s\S]*?throw new Error\("Super admin access required/.test(security)) {
  failures.push("requireSuperAdmin must fail closed after adminUsers lookup");
}
if (!/export async function requirePermission[\s\S]*?throw new Error\("Invalid admin credentials/.test(security)) {
  failures.push("requirePermission must fail closed after adminUsers lookup");
}
if (/legacyPin\s*=\s*settings\?\.adminPin\s*\?\?\s*[\"']0426[\"']/.test(security)) {
  failures.push("security.ts must not contain the legacy 0426 fallback");
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Admin PIN fail-closed security checks passed.");
