#!/usr/bin/env node
// Cloudflare Pages previews must compile against the inventory contract,
// while the production branch and local release builds retain the strict gate.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function resolveBuildGateMode(env = process.env) {
  const isPagesPreview =
    env.CF_PAGES === "1" &&
    typeof env.CF_PAGES_BRANCH === "string" &&
    env.CF_PAGES_BRANCH.length > 0 &&
    env.CF_PAGES_BRANCH !== "main";
  return isPagesPreview ? "--inventory" : "--build";
}

const invokedPath = process.argv[1] ? fileURLToPath(new URL("file://" + process.argv[1])) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const mode = resolveBuildGateMode();
  console.log(
    mode === "--inventory"
      ? "IFund preview build: running inventory consistency gate; production remains blocked."
      : "IFund release build: running strict production evidence gate."
  );
  const gatePath = fileURLToPath(new URL("./verify-migration-readiness.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [gatePath, mode], { stdio: "inherit" });
  process.exitCode = Number.isInteger(result.status) ? result.status : 1;
}
