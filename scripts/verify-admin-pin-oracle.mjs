import fs from "node:fs";

const authSource = fs.readFileSync("convex/auth.ts", "utf8");

const failures = [];

if (!authSource.includes("export const verifyAdminPin = internalQuery")) {
  failures.push("verifyAdminPin must remain internal-only");
}
if (/DEFAULT_ADMIN_PIN|0426/.test(authSource)) {
  failures.push("convex/auth.ts must not contain a hardcoded admin PIN or fallback credential");
}
if (!authSource.includes("const adminPin = settings?.adminPin;")) {
  failures.push("auth.ts must read the configured PIN without a fallback");
}
if (!authSource.includes("Boolean(adminPin) && pin === adminPin")) {
  failures.push("verifyAdminPin must fail closed when no configured PIN exists");
}
if (!authSource.includes("if (!adminPin || currentPin !== adminPin)")) {
  failures.push("updateAdminPin must fail closed when no configured PIN exists");
}
if (authSource.includes("ctx.db.insert(\"feeConfig\"")) {
  failures.push("updateAdminPin must not bootstrap feeConfig when no PIN exists");
}

if (failures.length) {
  console.error("Admin PIN oracle verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin PIN oracle verification passed.");
