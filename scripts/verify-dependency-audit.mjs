import { execFileSync } from "node:child_process";

let stdout = "";
try {
  stdout = execFileSync("npm", ["audit", "--audit-level=high", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  stdout = error?.stdout?.toString?.() ?? "";
}

if (!stdout) {
  console.error("npm audit produced no JSON report; validation cannot establish a dependency state.");
  process.exit(2);
}

const report = JSON.parse(stdout);
const metadata = report.metadata ?? {};
const vulnerabilities = metadata.vulnerabilities ?? {};

console.log(
  JSON.stringify(
    {
      high: vulnerabilities.high ?? 0,
      critical: vulnerabilities.critical ?? 0,
      total: vulnerabilities.total ?? 0,
    },
    null,
    2,
  ),
);

if ((vulnerabilities.high ?? 0) > 0 || (vulnerabilities.critical ?? 0) > 0) {
  console.error("High/critical dependency vulnerabilities remain.");
  console.error("Do not use npm audit fix --force blindly; triage affected packages and compatibility first.");
  process.exit(1);
}
