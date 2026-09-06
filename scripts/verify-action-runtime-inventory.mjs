import fs from "node:fs";
import path from "node:path";

const workflowsDir = path.resolve(".github/workflows");
const files = fs.readdirSync(workflowsDir).filter((name) => /\.(yml|yaml)$/.test(name));

const findings = [];

for (const file of files) {
  const fullPath = path.join(workflowsDir, file);
  const text = fs.readFileSync(fullPath, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/uses:\s*(actions\/(?:checkout|setup-node))@v4\b/.test(line)) {
      findings.push(`${file}:${index + 1}: ${line.trim()}`);
    }
    if (/node-version:\s*['\"]?20(?:\.\d+)?['\"]?\s*$/.test(line)) {
      findings.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

console.log("GitHub Actions Node-20-era inventory:");
if (findings.length === 0) {
  console.log("clean");
  process.exit(0);
}
for (const finding of findings) console.log(`- ${finding}`);

console.error(`Found ${findings.length} Node-20-era workflow declaration(s).`);
console.error("This is an inventory gate: migrate only supported declarations after reviewing workflow semantics; do not mass-edit or suppress findings.");
process.exit(1);
