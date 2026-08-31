import { readFile } from "node:fs/promises";

const sources = [
  "convex/security.ts",
  "convex/auth.ts",
];

let failed = false;

for (const file of sources) {
  const source = await readFile(file, "utf8");

  if (file === "convex/security.ts") {
    const internalInit = /export\s+const\s+initAdminPin\s*=\s*internalMutation\s*\(/.test(source);
    const publicInit = /export\s+const\s+initAdminPin\s*=\s*(?:mutation|action|query)\s*\(/.test(source);

    if (!internalInit || publicInit) {
      console.error(`FAIL: ${file} does not keep initAdminPin internal-only.`);
      failed = true;
    }
  }

  if (file === "convex/auth.ts") {
    const publicBootstrapFallback = /DEFAULT_ADMIN_PIN|legacyPin|\?\?\s*["'`]0426["'`]/.test(source);
    if (publicBootstrapFallback) {
      console.error(`FAIL: ${file} contains a public/default PIN bootstrap fallback.`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Admin PIN bootstrap boundary is not fail-closed.");
  process.exit(1);
}

console.log("PASS: admin PIN bootstrap remains internal-only and no legacy/default bootstrap fallback is present.");
