import fs from "node:fs";

const auth = fs.readFileSync("convex/auth.ts", "utf8");
const adminUsers = fs.readFileSync("convex/adminUsers.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

if (!auth.includes("export const verifyAdminPin = internalQuery")) {
  failures.push("verifyAdminPin must be internal-only");
}
if (/export const verifyAdminPin\s*=\s*query\s*\(/.test(auth)) {
  failures.push("verifyAdminPin must not be exported as a public query");
}
if (!auth.includes('.query("adminSettings")') || !auth.includes('.withIndex("byKey"')) {
  failures.push("verifyAdminPin must use the canonical adminSettings store");
}
if (/DEFAULT_ADMIN_PIN|["'`]0426["'`]|settings\?\.adminPin/.test(auth)) {
  failures.push("auth.ts contains a hardcoded/legacy feeConfig PIN authority");
}
if (!adminUsers.includes("export const recordLogin = internalMutation")) {
  failures.push("recordLogin must be internal-only");
}
if (/export const recordLogin\s*=\s*mutation\s*\(/.test(adminUsers)) {
  failures.push("recordLogin must not remain an anonymous public mutation");
}
if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("capacitor")) {
  failures.push("unrelated package metadata drift: capacitor keyword must be preserved");
}

if (failures.length) {
  console.error("Admin credential surface verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin credential surface verification: PASS");
