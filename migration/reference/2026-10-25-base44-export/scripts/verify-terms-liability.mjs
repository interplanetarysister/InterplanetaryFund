import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const read = async (name) => readFile(new URL("../" + name, import.meta.url), "utf8");
const termsSource = await read("src/components/TermsAcceptance.jsx");
const legalText = await read("src/lib/legalPolicy.js");
const recordSource = await read("base44/functions/recordLegalAcceptance/entry.ts");
const schemaSource = await read("base44/entities/LegalAcceptance.jsonc");
const appSource = await read("src/App.jsx");

const forbiddenFragments = [
  "$50", "per claim", "Michelle Rogers is not liable",
  "personally liable for losses", "personal liability for losses",
];
const scanExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".html"]);
const excludedDirectories = new Set(["node_modules", ".git", "dist", "build"]);
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (scanExtensions.has(extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}
const sourceFiles = await collectFiles(sourceRoot);
for (const file of sourceFiles) {
  const source = (await readFile(file, "utf8")).toLowerCase();
  for (const forbidden of forbiddenFragments) {
    assert(!source.includes(forbidden.toLowerCase()), `Prohibited personal liability assertion: ${file}: ${forbidden}`);
  }
}
assert.match(termsSource, /I Agree — Continue/);
assert.match(termsSource, /type="checkbox"/);
assert.match(termsSource, /disabled={!agreed \|\| submitting}/);
assert.match(termsSource, /recordLegalAcceptance/);
assert.match(termsSource, /if \(!isAuthenticated/);
assert.doesNotMatch(termsSource, /sessionStorage/);
assert.match(recordSource, /mode !== 'status' && mode !== 'accept'/);
assert.match(recordSource, /input\.explicit_consent !== true/);
assert.match(recordSource, /owner_user_id: userId/);
assert.match(recordSource, /accepted_at: new Date\(\)\.toISOString\(\)/);
assert.match(schemaSource, /"role": "admin"/);
assert.match(legalText, /TERMS_VERSION = "2026-10-13-v3"/);
assert.match(recordSource, /TERMS_VERSION = '2026-10-13-v3'/);
assert.match(legalText, /IF AND WHEN IFUND ENABLES ITS ON-PLATFORM CAMPAIGN CHECKOUT/);
assert.match(legalText, /three calendar days/);
assert.match(legalText, /14 calendar days/);
assert.match(legalText, /one payout request per day/);
assert.match(legalText, /may NOT lend, spend, pledge, collateralize/);
assert.match(termsSource, /planned campaign\s+checkout/);
assert.match(legalText, /authorized fundraising manager, promoter, publisher, or agent/);
assert.match(legalText, /negotiated exceptions or special permissions/);
assert.match(legalText, /THIS CAP DOES NOT APPLY TO AMOUNTS IFUND IS REQUIRED TO RETURN OR REMIT/);
assert.match(legalText, /NOTHING HERE EXCUSES/);
assert.match(appSource, /path="\/terms" element={<Terms \/>/);
assert.match(appSource, /path="\/privacy" element={<Privacy \/>/);
console.log(`Versioned legal clickwrap contract passed; scanned ${sourceFiles.length} source files.`);
