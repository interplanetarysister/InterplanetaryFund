import { readFile } from "node:fs/promises";

const files = ["convex/auth.ts", "convex/security.ts", "convex/adminUsers.ts"];
const forbiddenPatterns = [
  /DEFAULT_ADMIN_PIN\s*=\s*["'`]\d+["'`]/,
  /\?\?\s*["'`]0426["'`]/,
  /legacyPin\s*=\s*[^\n]*0426/,
  /["'`]0426["'`]/,
];

let failed = false;
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      console.error(`FAIL: ${file} matches ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Admin authorization boundary is not fail-closed: hardcoded/default PIN material remains.");
  process.exit(1);
}

console.log("PASS: no hardcoded/default admin PIN material found in the audited authorization files.");
