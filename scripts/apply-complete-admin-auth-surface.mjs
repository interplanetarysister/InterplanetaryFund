import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function must(condition, message) { if (!condition) throw new Error(message); }

const auth = `/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Legacy/bootstrap admin credential helpers are internal-only. Interactive
 * administration uses server-issued sessions from adminUsers.ts.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_PIN_KEY = "admin_pin";

// Internal bootstrap verification only. Never expose a PIN-validity oracle to clients.
export const verifyAdminPin = internalQuery({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    return { valid: Boolean(setting?.value) && pin === setting?.value };
  },
});

// Internal bootstrap maintenance only. Interactive PIN changes use
// adminUsers.updateOwnPin with a valid admin session.
export const updateAdminPin = internalMutation({
  args: { newPin: v.string() },
  handler: async (ctx, { newPin }) => {
    if (!/^\\d{4,}$/.test(newPin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    const now = new Date().toISOString();
    if (setting) {
      await ctx.db.patch(setting._id, { value: newPin, updatedAt: now });
      return { success: true, settingId: setting._id };
    }
    const settingId = await ctx.db.insert("adminSettings", {
      key: ADMIN_PIN_KEY,
      value: newPin,
      updatedAt: now,
    });
    return { success: true, settingId };
  },
});
`;
write('convex/auth.ts', auth);

const security = `/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Shared non-admin security helpers. Admin authorization is centralized in
 * adminUsers.ts and uses server-issued session tokens, never a PIN argument.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_PIN_KEY = "admin_pin";

export async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required. Sign in to perform this action.");
  return identity;
}

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now - entry.lastReset > windowMs) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return true;
  }
  if (entry.count >= maxAttempts) {
    throw new Error(\`Rate limit exceeded. Try again in \${Math.ceil(windowMs / 1000)} seconds.\`);
  }
  entry.count++;
  return true;
}

export function validateDonation(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 100000;
}

export function validateWithdrawal(amount: number, availableBalance: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= availableBalance && amount <= 50000;
}

// Internal-only settings access prevents public reads of privileged values such as admin_pin.
export const getAdminSetting = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", key))
      .first();
    return setting?.value ?? null;
  },
});

// Bootstrap-only credential initialization. No public caller can claim the first PIN.
export const initAdminPin = internalMutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!/^\\d{4,}$/.test(pin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    if (existing) throw new Error("Admin PIN already initialized.");
    const settingId = await ctx.db.insert("adminSettings", {
      key: ADMIN_PIN_KEY,
      value: pin,
      updatedAt: new Date().toISOString(),
    });
    return { status: "success", settingId };
  },
});

// Bootstrap maintenance only. Interactive administrators change their own PIN
// through adminUsers.updateOwnPin after session verification.
export const changeAdminPin = internalMutation({
  args: { newPin: v.string() },
  handler: async (ctx, { newPin }) => {
    if (!/^\\d{4,}$/.test(newPin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    if (!existing) throw new Error("Admin PIN is not initialized.");
    await ctx.db.patch(existing._id, { value: newPin, updatedAt: new Date().toISOString() });
    return { status: "success" };
  },
});
`;
write('convex/security.ts', security);

let adminUsers = read('convex/adminUsers.ts');
const legacyBootstrap = `  const configured = await ctx.db.query("adminSettings").withIndex("byKey", (q: any) => q.eq("key", "admin_pin")).first();\n  const legacy = await ctx.db.query("feeConfig").first();\n  const configuredPin = configured?.value || legacy?.adminPin;`;
must(adminUsers.includes(legacyBootstrap), 'adminUsers legacy bootstrap block not found');
adminUsers = adminUsers.replace(legacyBootstrap, `  const configured = await ctx.db.query("adminSettings").withIndex("byKey", (q: any) => q.eq("key", "admin_pin")).first();\n  const configuredPin = configured?.value;`);
write('convex/adminUsers.ts', adminUsers);

const inbox = `/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Universal inbox. Integration ingestion is server-internal; inbox visibility
 * and management require the same server-issued admin session as the cockpit.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";

export const recordMessage = internalMutation({
  args: {
    platform: v.string(), senderName: v.string(), senderId: v.string(), recipientId: v.string(),
    subject: v.optional(v.string()), body: v.string(), platformMessageId: v.string(),
    platformUrl: v.optional(v.string()), groupId: v.optional(v.string()), groupName: v.optional(v.string()),
    campaignId: v.optional(v.string()), forwarded: v.boolean(), replied: v.boolean(), priority: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("universalInbox", {
      ...args, status: "new", forwardedAt: undefined, repliedAt: undefined,
      replyContent: undefined, receivedAt: new Date().toISOString(),
    });
    return { success: true, messageId: id };
  },
});

export const getInboxMessages = query({
  args: { sessionToken: v.string(), status: v.optional(v.string()), platform: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, status, platform }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    let messages = await ctx.db.query("universalInbox").collect();
    if (status) messages = messages.filter((m) => m.status === status);
    if (platform) messages = messages.filter((m) => m.platform === platform);
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});

export const getUnreadCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    const all = await ctx.db.query("universalInbox").collect();
    return {
      total: all.length,
      unread: all.filter((m) => m.status === "new").length,
      highPriority: all.filter((m) => m.status === "new" && m.priority === "high").length,
      byPlatform: {
        facebook: all.filter((m) => m.platform === "facebook" && m.status === "new").length,
        instagram: all.filter((m) => m.platform === "instagram" && m.status === "new").length,
        email: all.filter((m) => m.platform === "email" && m.status === "new").length,
      },
    };
  },
});

export const markRead = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, { status: "read" });
    return { success: true };
  },
});

export const markForwarded = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, { forwarded: true, forwardedAt: new Date().toISOString() });
    return { success: true };
  },
});

export const recordReply = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox"), replyContent: v.string() },
  handler: async (ctx, { sessionToken, messageId, replyContent }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, {
      replied: true, repliedAt: new Date().toISOString(), replyContent, status: "replied",
    });
    return { success: true };
  },
});

export const getInboxStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    const all = await ctx.db.query("universalInbox").collect();
    const today = new Date().toISOString().split("T")[0];
    return {
      total: all.length,
      new: all.filter((m) => m.status === "new").length,
      read: all.filter((m) => m.status === "read").length,
      replied: all.filter((m) => m.status === "replied").length,
      forwarded: all.filter((m) => m.forwarded).length,
      today: all.filter((m) => m.receivedAt.startsWith(today)).length,
      byPlatform: {
        facebook: all.filter((m) => m.platform === "facebook").length,
        instagram: all.filter((m) => m.platform === "instagram").length,
        email: all.filter((m) => m.platform === "email").length,
      },
      highPriorityUnread: all.filter((m) => m.status === "new" && m.priority === "high").length,
    };
  },
});

export const sendAdminMessage = mutation({
  args: {
    sessionToken: v.string(), recipientId: v.string(), subject: v.string(), body: v.string(),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, recipientId, subject, body, priority }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    const id = await ctx.db.insert("universalInbox", {
      platform: "admin", senderName: principal.name || "Interplanetary Fund Admin",
      senderId: String(principal._id), recipientId, subject, body,
      platformMessageId: \`admin_msg_\${Date.now()}\`, platformUrl: undefined,
      groupId: undefined, groupName: undefined, campaignId: undefined,
      status: "new", forwarded: false, replied: false, priority: priority ?? "normal",
      receivedAt: new Date().toISOString(),
    });
    return { success: true, messageId: id };
  },
});

export const getAdminMessages = query({
  args: { sessionToken: v.string(), recipientId: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, recipientId }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    let messages = await ctx.db.query("universalInbox")
      .filter((q: any) => q.eq(q.field("platform"), "admin")).collect();
    if (recipientId) messages = messages.filter((m) => m.recipientId === recipientId);
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});
`;
write('convex/inbox.ts', inbox);

const automation = `/*
 * Interplanetary Fund — Agent automation authorization boundary.
 * This compatibility entry point uses the same super-admin session as the
 * primary agent automation controls. PIN arguments are not accepted.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdminSession } from "./adminUsers";
import { checkRateLimit } from "./security";

export const toggleAgentAutomation = mutation({
  args: { sessionToken: v.string(), agentName: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, agentName, enabled }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    checkRateLimit(\`agent-automation-toggle:\${principal._id}\`, 5, 60_000);
    const agent = await ctx.db.query("agents").filter((q) => q.eq(q.field("name"), agentName)).first();
    if (!agent) return { success: false, error: "Agent not found" };
    await ctx.db.patch(agent._id, { automationEnabled: enabled });
    await ctx.db.insert("agentActivityLog", {
      agentName, action: enabled ? "automation_enabled" : "automation_disabled", category: "protocol",
      description: \`\${agentName} automation \${enabled ? "enabled" : "disabled"} by \${principal.name}\`,
      creditCost: 0, timestamp: new Date().toISOString(),
    });
    return { success: true, agentName, automationEnabled: enabled };
  },
});
`;
write('convex/agentAutomationAuthorization.ts', automation);

let withdraw = read('convex/secureWithdraw.ts');
withdraw = withdraw.replace('import { requireAuth, checkRateLimit, validateWithdrawal } from "./security";', 'import { requireAuth, checkRateLimit, validateWithdrawal } from "./security";\nimport { requireSuperAdminSession } from "./adminUsers";');
withdraw = withdraw.replaceAll('feeConfig?.platformFeePercent ?? 5', 'feeConfig?.platformFeePercent ?? 3');
must(withdraw.includes('adminPin: v.string()'), 'secureWithdraw adminPin arg not found');
withdraw = withdraw.replace('adminPin: v.string(),', 'sessionToken: v.string(),');
const oldWithdrawAuth = `    const { requireSuperAdmin } = await import("./security");\n    await requireSuperAdmin(ctx, args.adminPin);`;
must(withdraw.includes(oldWithdrawAuth), 'secureWithdraw PIN auth block not found');
withdraw = withdraw.replace(oldWithdrawAuth, '    await requireSuperAdminSession(ctx, args.sessionToken);');
write('convex/secureWithdraw.ts', withdraw);

let migration = read('convex/fundMigration.ts');
migration = migration.replace('import { validateDonation, checkRateLimit } from "./security";', 'import { validateDonation, checkRateLimit } from "./security";\nimport { requireAdminSession } from "./adminUsers";');
migration = migration.replaceAll(' * 0.05', ' * 0.03');
must(migration.includes('adminPin: v.optional(v.string()),'), 'fundMigration optional adminPin not found');
migration = migration.replace('adminPin: v.optional(v.string()),', 'sessionToken: v.string(),');
const batchHandler = '  handler: async (ctx, args) => {\n    checkRateLimit("fund_migration", 5, 300000); // Max 5 per 5 min\n    const results = [];';
must(migration.includes(batchHandler), 'fundMigration batch handler marker not found');
migration = migration.replace(batchHandler, '  handler: async (ctx, args) => {\n    const principal = await requireAdminSession(ctx, args.sessionToken, "finance");\n    checkRateLimit(`fund_migration_admin:${principal._id}`, 5, 300000);\n    const results = [];');
migration = migration.replace('withdrawnBy: args.withdrawnBy,', 'withdrawnBy: principal.name,');
write('convex/fundMigration.ts', migration);

const verifier = `import fs from "node:fs";\nimport path from "node:path";\n\nconst root = process.cwd();\nconst failures = [];\nconst check = (ok, msg) => { if (!ok) failures.push(msg); };\nconst read = (p) => fs.readFileSync(path.join(root, p), "utf8");\nconst files = fs.readdirSync(path.join(root, "convex")).filter((f) => f.endsWith(".ts"));\nconst sources = files.map((f) => [f, read(\`convex/\${f}\`)]);\n\nfor (const [file, source] of sources) {\n  check(!source.includes('"0426"') && !source.includes("DEFAULT_ADMIN_PIN"), \`\${file}: hardcoded/default admin credential remains\`);\n  check(!/adminPin\\s*:\\s*v\\.(?:optional\\()?string/.test(source), \`\${file}: public adminPin argument remains\`);\n  check(!/requestorPin\\s*:\\s*v\\.(?:optional\\()?string/.test(source), \`\${file}: public requestorPin argument remains\`);\n  if (file !== "security.ts") {\n    check(!source.includes("requireSuperAdmin(ctx"), \`\${file}: legacy requireSuperAdmin helper remains\`);\n    check(!source.includes("requirePermission(ctx"), \`\${file}: legacy requirePermission helper remains\`);\n  }\n}\n\nconst auth = read("convex/auth.ts");\ncheck(auth.includes("verifyAdminPin = internalQuery"), "auth.ts: PIN verification must be internal-only");\ncheck(auth.includes("updateAdminPin = internalMutation"), "auth.ts: bootstrap PIN update must be internal-only");\n\nconst security = read("convex/security.ts");\nfor (const name of ["getAdminSetting", "initAdminPin", "changeAdminPin"]) {\n  check(new RegExp(\`export const \\${name} = internal\`).test(security), \`security.ts: \${name} must be internal-only\`);\n}\ncheck(!security.includes("export async function requireAdmin("), "security.ts: PIN-based requireAdmin helper remains");\ncheck(!security.includes("export async function requireSuperAdmin("), "security.ts: PIN-based requireSuperAdmin helper remains");\ncheck(!security.includes("export async function requirePermission("), "security.ts: PIN-based requirePermission helper remains");\n\nconst adminUsers = read("convex/adminUsers.ts");\ncheck(!adminUsers.includes('query("feeConfig").first()'), "adminUsers.ts: bootstrap still trusts feeConfig credential");\ncheck(adminUsers.includes("issueSession"), "adminUsers.ts: server session issuance missing");\ncheck(adminUsers.includes("byTokenHash"), "adminUsers.ts: session hash lookup missing");\n\nconst inbox = read("convex/inbox.ts");\ncheck(inbox.includes("recordMessage = internalMutation"), "inbox.ts: integration ingestion must be internal-only");\ncheck(inbox.includes('requireAdminSession(ctx, sessionToken, "content")'), "inbox.ts: content session boundary missing");\ncheck(inbox.includes("requireSuperAdminSession(ctx, sessionToken)"), "inbox.ts: super-admin messaging boundary missing");\n\nconst sw = read("convex/secureWithdraw.ts");\ncheck(sw.includes("sessionToken: v.string()"), "secureWithdraw.ts: admin completion session token missing");\ncheck(sw.includes("requireSuperAdminSession(ctx, args.sessionToken)"), "secureWithdraw.ts: super-admin completion guard missing");\ncheck(!sw.includes("platformFeePercent ?? 5"), "secureWithdraw.ts: obsolete 5% withdrawal fallback remains");\n\nconst aa = read("convex/agentAutomationAuthorization.ts");\ncheck(aa.includes("requireSuperAdminSession(ctx, sessionToken)"), "agentAutomationAuthorization.ts: session guard missing");\n\nconst fm = read("convex/fundMigration.ts");\ncheck(fm.includes('requireAdminSession(ctx, args.sessionToken, "finance")'), "fundMigration.ts: batch finance session guard missing");\ncheck(!fm.includes("adminPin"), "fundMigration.ts: legacy adminPin remains");\ncheck(!fm.includes(" * 0.05"), "fundMigration.ts: obsolete 5% migration fee remains");\n\nif (failures.length) {\n  for (const failure of failures) console.error(\`FAIL: \${failure}\`);\n  process.exit(1);\n}\nconsole.log("Complete admin authentication and integration boundary checks passed.");\n`;
write('scripts/verify-complete-admin-auth-surface.mjs', verifier);

console.log('Applied complete admin authentication and integration surface repair.');
