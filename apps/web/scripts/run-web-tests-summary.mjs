// Run the complete existing web test suite while preserving actionable build diagnostics.
// Cloudflare Pages truncates verbose per-test output; never hide a failed test.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = readdirSync(path.join(root, "tests"))
  .filter(name => /\.test\.m?js$/.test(name))
  .sort().map(name => "tests/" + name);
const files = [...local, "../../tests/paypal-sandbox-handler.test.js",
  "../../tests/paypal-sandbox-security.test.js",
  "../../tests/agent-browser-policy.test.mjs",
  "../../tests/browser-tooling-install.test.mjs",
  "../../tests/skill-placement-contract.test.mjs",
  "../../tests/restored-distinct-files.test.mjs"];
const child = spawn(process.execPath, ["--test", "--test-reporter=spec", ...files],
  { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let output = "", errors = "";
const max = 24 * 1024 * 1024;
let overflow = false;
child.stdout.on("data", data => {
  if (output.length + data.length > max) { overflow = true; child.kill(); return; }
  output += data.toString("utf8");
});
child.stderr.on("data", data => {
  if (errors.length + data.length > max) { overflow = true; child.kill(); return; }
  errors += data.toString("utf8");
});
child.on("error", cause => { console.error("Test process could not start:", cause); process.exitCode = 1; });
child.on("close", (code, signal) => {
  const summary = output.split("\n").filter(line =>
    /(?:ℹ|#) (?:tests|pass|fail|cancelled|skipped|duration)/.test(line));
  console.log("Complete web test results (" + files.length + " test files):");
  console.log(summary.slice(-10).join("\n") || "No summary was produced.");
  if (overflow) console.error("Test output exceeded the safety limit.");
  if (code !== 0 || overflow || signal) {
    const marker = output.lastIndexOf("✖ failing tests:");
    const details = marker >= 0 ? output.slice(marker) : output.slice(-50000);
    console.error("Full failing-test diagnostics:\n" + details.slice(0,180000));
    if (errors.trim()) console.error(errors.slice(-20000));
    process.exitCode = 1;
  }
});
