import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auth = fs.readFileSync(path.join(root, "convex", "auth.ts"), "utf8");
const adminUsers = fs.readFileSync(path.join(root, "convex", "adminUsers.ts"), "utf8");
const failures = [];

const verify = auth.match(/export const verifyAdminPin\s*=\s*query\(\{[\s\S]*?\n\}\);/);
if (!verify) {
  failures.push("verifyAdminPin implementation could not be located");
} else {
  failures.push("verifyAdminPin must not be a public query that returns credential validity");
}

const recordLogin = adminUsers.match(/export const recordLogin\s*=\s*mutation\(\{[\s\S]*?\n\}\);/);
if (recordLogin) {
  failures.push("recordLogin must not be a public mutation accepting a PIN as caller identity");
}

const recordLoginDefinition = adminUsers.match(/(?:export const\s+)?recordLogin\s*=\s*(?:internalMutation|mutation)\(\{[\s\S]*?\n\}\);/);
if (recordLoginDefinition && /mutation\(/.test(recordLoginDefinition[0]) && !/internalMutation\(/.test(recordLoginDefinition[0])) {
  failures.push("recordLogin must use an authenticated identity boundary or internal-only invocation");
}

if (failures.length) {
  console.error("Admin credential surface guard FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin credential surface guard passed.");
