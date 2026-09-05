import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value);
const must = (condition, message) => { if (!condition) throw new Error(message); };

function protectWithdrawalViews(source, label) {
  const pendingStart = source.indexOf("export const getPendingWithdrawals = query({");
  must(pendingStart >= 0, `${label}: pending withdrawals query not found`);
  const pendingArgs = source.indexOf("  args: {},", pendingStart);
  const pendingHandler = source.indexOf("  handler: async (ctx) => {", pendingArgs);
  must(pendingArgs >= 0 && pendingHandler >= 0, `${label}: pending withdrawals query shape changed`);
  source = source.slice(0, pendingArgs) + "  args: { sessionToken: v.string() }," + source.slice(pendingArgs + "  args: {},".length);
  const shiftedHandler = source.indexOf("  handler: async (ctx) => {", pendingStart);
  source = source.slice(0, shiftedHandler) + "  handler: async (ctx, { sessionToken }) => {\n    await requireSuperAdminSession(ctx, sessionToken);" + source.slice(shiftedHandler + "  handler: async (ctx) => {".length);

  const historyStart = source.indexOf("export const getWithdrawalHistory = query({");
  must(historyStart >= 0, `${label}: withdrawal history query not found`);
  const historyArgs = source.indexOf("  args: { campaignId: v.optional(v.string()) },", historyStart);
  const historyHandler = source.indexOf("  handler: async (ctx, { campaignId }) => {", historyArgs);
  must(historyArgs >= 0 && historyHandler >= 0, `${label}: withdrawal history query shape changed`);
  source = source.slice(0, historyArgs) + "  args: { sessionToken: v.string(), campaignId: v.optional(v.string()) }," + source.slice(historyArgs + "  args: { campaignId: v.optional(v.string()) },".length);
  const shiftedHistoryHandler = source.indexOf("  handler: async (ctx, { campaignId }) => {", historyStart);
  source = source.slice(0, shiftedHistoryHandler) + "  handler: async (ctx, { sessionToken, campaignId }) => {\n    await requireAdminSession(ctx, sessionToken, \"finance\");" + source.slice(shiftedHistoryHandler + "  handler: async (ctx, { campaignId }) => {".length);

  return source;
}

let secure = read("convex/secureWithdraw.ts");
secure = secure.replace('import { query, mutation } from "./_generated/server";', 'import { query, mutation, internalMutation } from "./_generated/server";');
if (secure.includes('import { requireSuperAdminSession } from "./adminUsers";')) {
  secure = secure.replace('import { requireSuperAdminSession } from "./adminUsers";', 'import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";');
} else if (!secure.includes('requireAdminSession, requireSuperAdminSession')) {
  secure = secure.replace('import { v } from "convex/values";', 'import { v } from "convex/values";\nimport { requireAdminSession, requireSuperAdminSession } from "./adminUsers";');
}
secure = secure.replaceAll('adminPin: v.string(),', 'sessionToken: v.string(),');
secure = secure.replaceAll('    const { requireSuperAdmin } = await import("./security");\n    await requireSuperAdmin(ctx, args.adminPin);', '    await requireSuperAdminSession(ctx, args.sessionToken);');
secure = secure.replace('export const confirmPendingDonations = mutation({', 'export const confirmPendingDonations = internalMutation({');
secure = protectWithdrawalViews(secure, "secureWithdraw.ts");
write("convex/secureWithdraw.ts", secure);

let simple = read("convex/simpleWithdraw.ts");
simple = simple.replace('import { query, mutation } from "./_generated/server";', 'import { query, mutation, internalMutation } from "./_generated/server";');
simple = simple.replace('import { v } from "convex/values";', 'import { v } from "convex/values";\nimport { requireAdminSession, requireSuperAdminSession } from "./adminUsers";');
simple = simple.replaceAll(' * 0.05', ' * 0.03');

const completeStart = simple.indexOf('export const completeWithdrawal = mutation({');
must(completeStart >= 0, 'simpleWithdraw.ts: completeWithdrawal not found');
const completeArgs = simple.indexOf('  args: {\n    payoutId:', completeStart);
must(completeArgs >= 0, 'simpleWithdraw.ts: completeWithdrawal args not found');
simple = simple.slice(0, completeArgs) + '  args: {\n    sessionToken: v.string(),\n    payoutId:' + simple.slice(completeArgs + '  args: {\n    payoutId:'.length);
const completeHandler = simple.indexOf('  handler: async (ctx, args) => {', completeStart);
must(completeHandler >= 0, 'simpleWithdraw.ts: completeWithdrawal handler not found');
simple = simple.slice(0, completeHandler) + '  handler: async (ctx, args) => {\n    await requireSuperAdminSession(ctx, args.sessionToken);' + simple.slice(completeHandler + '  handler: async (ctx, args) => {'.length);

simple = simple.replace('export const confirmPendingDonations = mutation({', 'export const confirmPendingDonations = internalMutation({');
simple = protectWithdrawalViews(simple, "simpleWithdraw.ts");
write("convex/simpleWithdraw.ts", simple);

let treasury = read("convex/treasury.ts");
treasury = treasury.replace('import { requireSuperAdmin } from "./security";\n', '');
write("convex/treasury.ts", treasury);

console.log("Applied duplicate withdrawal admin authorization augmentation and removed stale PIN-auth imports.");
