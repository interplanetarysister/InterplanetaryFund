import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const convexFiles = fs.readdirSync(path.join(root, "convex")).filter((name) => name.endsWith(".ts"));
for (const name of convexFiles) {
  const source = read(`convex/${name}`);
  check(!source.includes('"0426"') && !source.includes("DEFAULT_ADMIN_PIN"), `${name}: hardcoded/default admin credential remains`);
}

const auth = read("convex/auth.ts");
check(auth.includes("verifyAdminPin = internalQuery"), "auth.ts: PIN verification must be internal-only");
check(auth.includes("updateAdminPin = internalMutation"), "auth.ts: bootstrap PIN update must be internal-only");
check(!auth.includes("feeConfig"), "auth.ts: financial configuration must not be an authentication source");

const security = read("convex/security.ts");
check(security.includes("getAdminSetting = internalQuery"), "security.ts: admin settings reader must be internal-only");
check(security.includes("initAdminPin = internalMutation"), "security.ts: PIN initialization must be internal-only");
check(security.includes("changeAdminPin = internalMutation"), "security.ts: bootstrap PIN change must be internal-only");
check(!security.includes("export async function requireAdmin("), "security.ts: PIN-based requireAdmin helper remains");
check(!security.includes("export async function requireSuperAdmin("), "security.ts: PIN-based requireSuperAdmin helper remains");
check(!security.includes("export async function requirePermission("), "security.ts: PIN-based requirePermission helper remains");

const adminUsers = read("convex/adminUsers.ts");
check(!adminUsers.includes('query("feeConfig").first()'), "adminUsers.ts: bootstrap still trusts feeConfig credential");
check(adminUsers.includes("issueSession"), "adminUsers.ts: server session issuance missing");
check(adminUsers.includes("byTokenHash"), "adminUsers.ts: hashed session lookup missing");

const inbox = read("convex/inbox.ts");
check(inbox.includes("recordMessage = internalMutation"), "inbox.ts: integration ingestion must be internal-only");
check(inbox.includes('requireAdminSession(ctx, sessionToken, "content")'), "inbox.ts: content session permission boundary missing");
check(inbox.includes("requireSuperAdminSession(ctx, sessionToken)"), "inbox.ts: super-admin messaging boundary missing");
check(!inbox.includes("adminPin:"), "inbox.ts: legacy adminPin argument remains");

const secureWithdraw = read("convex/secureWithdraw.ts");
check(secureWithdraw.includes("sessionToken: v.string()"), "secureWithdraw.ts: admin session token missing");
check(secureWithdraw.includes("requireSuperAdminSession(ctx, args.sessionToken)"), "secureWithdraw.ts: super-admin mutation guard missing");
check(secureWithdraw.includes("confirmPendingDonations = internalMutation"), "secureWithdraw.ts: testing donation confirmation must be internal-only");
check(secureWithdraw.includes("getPendingWithdrawals = query"), "secureWithdraw.ts: pending withdrawal view missing");
check(secureWithdraw.includes('requireAdminSession(ctx, sessionToken, "finance")'), "secureWithdraw.ts: withdrawal history finance guard missing");
check(!secureWithdraw.includes("adminPin:"), "secureWithdraw.ts: legacy adminPin argument remains");
check(!secureWithdraw.includes("platformFeePercent ?? 5"), "secureWithdraw.ts: obsolete 5% withdrawal fallback remains");

const simpleWithdraw = read("convex/simpleWithdraw.ts");
check(simpleWithdraw.includes("sessionToken: v.string()"), "simpleWithdraw.ts: admin session token missing");
check(simpleWithdraw.includes("requireSuperAdminSession(ctx, args.sessionToken)"), "simpleWithdraw.ts: payout completion super-admin guard missing");
check(simpleWithdraw.includes("confirmPendingDonations = internalMutation"), "simpleWithdraw.ts: testing donation confirmation must be internal-only");
check(simpleWithdraw.includes('requireAdminSession(ctx, sessionToken, "finance")'), "simpleWithdraw.ts: withdrawal history finance guard missing");
check(!simpleWithdraw.includes(" * 0.05"), "simpleWithdraw.ts: obsolete 5% withdrawal fee remains");

const automation = read("convex/agentAutomationAuthorization.ts");
check(automation.includes("sessionToken: v.string()"), "agentAutomationAuthorization.ts: session token missing");
check(automation.includes("requireSuperAdminSession(ctx, sessionToken)"), "agentAutomationAuthorization.ts: super-admin session guard missing");
check(!automation.includes("requestorPin"), "agentAutomationAuthorization.ts: legacy requestorPin remains");

const migration = read("convex/fundMigration.ts");
check(migration.includes('requireAdminSession(ctx, args.sessionToken, "finance")'), "fundMigration.ts: batch migration finance session guard missing");
check(!migration.includes("adminPin:"), "fundMigration.ts: legacy adminPin argument remains");
check(!migration.includes(" * 0.05"), "fundMigration.ts: obsolete 5% migration fee remains");

for (const relative of [
  "convex/fraudControl.ts",
  "convex/userManagement.ts",
  "convex/treasury.ts",
  "convex/agents.ts",
  "convex/agentAutomation.ts",
  "convex/campaigns.ts",
]) {
  const source = read(relative);
  check(!source.includes("adminPin: v.string()"), `${relative}: old admin PIN argument returned`);
  check(!source.includes("requestorPin: v.string()"), `${relative}: old requestor PIN argument returned`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log("Complete admin authentication and integration boundary checks passed.");
