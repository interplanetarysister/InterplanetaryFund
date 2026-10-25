import fs from "node:fs";
import path from "node:path";

const roots = ["src", "base44"];
const allowed = new Set([
  "base44/functions/syncFromConvex/entry.ts",
  "base44/functions/validateIntegrationHealth/entry.ts",
]);
const activePatterns = [
  /convex\/react/i,
  /from\s+["'][^"']*convex/i,
  /CONVEX_[A-Z0-9_]+/,
  /\.convex\.cloud/i,
  /\.convex\.site/i,
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

const violations = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const normalized = file.replaceAll("\\", "/");
    if (allowed.has(normalized)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (activePatterns.some((pattern) => pattern.test(source))) violations.push(normalized);
  }
}

if (violations.length) {
  console.error("Active Convex runtime dependency found:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("No active Convex runtime dependency exists in src/ or base44/.");
