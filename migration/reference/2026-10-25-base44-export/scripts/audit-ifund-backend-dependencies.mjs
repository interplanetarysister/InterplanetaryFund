#!/usr/bin/env node
// Static inventory for replacing Base44 dependencies; never reads credentials or user data.
// Source references are NOT proof that a capability works on an independent host.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const scanRoots = ["src", "base44/functions"];
const allowed = /\.(?:js|jsx|ts|tsx|mjs)$/;
const counts = new Map();
const files = new Map();
const unresolved = [];
let scannedFiles = 0;

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full); continue; }
    if (!entry.isFile() || !allowed.test(entry.name)) continue;
    const source = await readFile(full, "utf8");
    scannedFiles++;
    const relative = path.relative(root, full).replaceAll(path.sep, "/");
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      // Keep this conservative: these are literal references, not an AST/call graph.
      const patterns = [
        ["entity", /\bbase44\.(?:asServiceRole\.)?entities\.([A-Za-z_$][\w$]*)/g],
        ["function", /\bbase44\.(?:asServiceRole\.)?functions\.invoke\(\s*['"`]([^'"`]+)['"`]/g],
        ["auth", /\bbase44\.auth\.([A-Za-z_$][\w$]*)/g],
        ["integration", /\bbase44\.(?:asServiceRole\.)?integrations\.([A-Za-z_$][\w$]*)/g],
      ];
      for (const [kind, regex] of patterns) {
        for (const match of line.matchAll(regex)) {
          const key = kind + ":" + match[1];
          counts.set(key, (counts.get(key) || 0) + 1);
          if (!files.has(key)) files.set(key, new Set());
          files.get(key).add(relative);
        }
      }
      if (/\bbase44\.(?:asServiceRole\.)?(?:entities|functions|auth|integrations)\b/.test(line)
          && !patterns.some(([, regex]) => { regex.lastIndex = 0; return regex.test(line); })) {
        unresolved.push({ file: relative, line: index + 1 });
      }
    }
  }
}
for (const dir of scanRoots) await walk(path.join(root, dir));
const dependencies = [...counts].map(([key, occurrences]) => {
  const [kind, name] = key.split(/:(.*)/s);
  return { kind, name, occurrences, files: [...files.get(key)].sort() };
}).sort((a, b) => b.occurrences - a.occurrences || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const byKind = Object.fromEntries(["entity", "function", "auth", "integration"].map(kind =>
  [kind, { references: dependencies.filter(x => x.kind === kind).reduce((n, x) => n + x.occurrences, 0),
           unique: dependencies.filter(x => x.kind === kind).length }]));
const result = {
  source_only: true,
  live_parity_verified: false,
  meaning: "Literal source references, not independent implementation or authorization evidence",
  scanned_files: scannedFiles,
  by_kind: byKind,
  unresolved_reference_lines: unresolved.length,
  dependencies,
  unresolved
};
if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  console.log("IFund Base44 dependency inventory (source only; NOT cutover proof)");
  console.log(JSON.stringify({ scanned_files: scannedFiles, by_kind: byKind, unresolved_reference_lines: unresolved.length }, null, 2));
  console.log("Top references:");
  for (const item of dependencies.slice(0, 15)) console.log(item.kind + ":" + item.name + " " + item.occurrences + " refs / " + item.files.length + " files");
}
