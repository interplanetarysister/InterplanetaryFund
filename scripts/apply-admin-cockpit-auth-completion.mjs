import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANCH='solstice/admin-session-integration-auth';
function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
function rep(s,a,b,label){if(!s.includes(a)) throw new Error(`missing ${label}`); return s.replace(a,b)}
function remote(path){return execFileSync('git',['show',`origin/${BRANCH}:${path}`],{encoding:'utf8',maxBuffer:20*1024*1024})}

execFileSync('git',['fetch','origin',`${BRANCH}:refs/remotes/origin/${BRANCH}`],{stdio:'inherit'});

// Export a shared super-admin session helper from the stronger hashed-token implementation.
{
  const p='convex/adminUsers.ts'; let s=read(p);
  const marker='async function bootstrapConfiguredSuperAdmin(ctx: any, pin: string) {';
  if(!s.includes('export async function requireSuperAdminSession')) {
    s=rep(s,marker,`export async function requireSuperAdminSession(ctx: any, sessionToken: string) {\n  const principal = await requireAdminSession(ctx, sessionToken);\n  if (principal.role !== "super_admin") throw new Error("Super admin access required");\n  return principal;\n}\n\n${marker}`,'super-admin session helper');
  }
  write(p,s);
}

function adaptSolsticeServer(path){
  let s=remote(path);
  s=s.replaceAll('from "./adminSession"','from "./adminUsers"');
  s=s.replace(/\nconst SESSION_ID = v\.id\("adminSettings"\);\n/g,'\n');
  s=s.replaceAll('sessionId: SESSION_ID','sessionToken: v.string()');
  s=s.replaceAll('sessionId','sessionToken');
  return s;
}
function adaptSolsticeClient(path){
  let s=remote(path);
  s=s.replaceAll('sessionId','sessionToken');
  s=s.replaceAll('sessionToken as any','sessionToken');
  return s;
}

write('convex/fraudControl.ts', adaptSolsticeServer('convex/fraudControl.ts'));
write('convex/userManagement.ts', adaptSolsticeServer('convex/userManagement.ts'));
write('src/components/FraudControl.tsx', adaptSolsticeClient('src/components/FraudControl.tsx'));
write('src/components/UserManagement.tsx', adaptSolsticeClient('src/components/UserManagement.tsx'));

// Session-protect the one-time mass migration while keeping the scheduled worker internal.
{
  const p='convex/protocolAutoFix.ts'; let s=read(p);
  if(!s.includes('from "./adminUsers"')) s=rep(s,'import { v } from "convex/values";','import { v } from "convex/values";\nimport { requireAdminSession } from "./adminUsers";','protocol auth import');
  s=rep(s,'export const migrateAllCampaigns = mutation({\n  args: {},\n  handler: async (ctx) => {','export const migrateAllCampaigns = mutation({\n  args: { sessionToken: v.string() },\n  handler: async (ctx, { sessionToken }) => {\n    await requireAdminSession(ctx, sessionToken, "campaigns");','migration authorization');
  write(p,s);
}

// Add explicit admin-finance APIs and lock the existing admin-only completion/config endpoints.
{
  const p='convex/treasury.ts'; let s=read(p);
  if(!s.includes('from "./adminUsers"')) s=rep(s,'import { v } from "convex/values";','import { v } from "convex/values";\nimport { requireAdminSession, requireSuperAdminSession } from "./adminUsers";','treasury session import');

  const insertBefore='// Mutation: Create a deposit (user migrates funds from external platform)';
  const adminApis=`// Admin-only treasury snapshot. Public/user APIs remain separate.\nexport const getAdminBalances = query({\n  args: { sessionToken: v.string() },\n  handler: async (ctx, { sessionToken }) => {\n    await requireAdminSession(ctx, sessionToken, "finance");\n    const monitoredCampaigns = await ctx.db.query("monitoredCampaigns").collect();\n    const userCampaigns = await ctx.db.query("userCampaigns").collect();\n    const externalPlatforms = await ctx.db.query("externalPlatforms").collect();\n    const holdingAccounts = await ctx.db.query("holdingAccounts").collect();\n    const localRaised = monitoredCampaigns.reduce((n,c)=>n+(c.raisedAmount||0),0)+userCampaigns.reduce((n,c)=>n+(c.raisedAmount||0),0);\n    const localGoal = monitoredCampaigns.reduce((n,c)=>n+(c.goalAmount||0),0)+userCampaigns.reduce((n,c)=>n+(c.goalAmount||0),0);\n    const localDonors = monitoredCampaigns.reduce((n,c)=>n+(c.donorCount||0),0)+userCampaigns.reduce((n,c)=>n+(c.donorCount||0),0);\n    const extRaised = externalPlatforms.reduce((n,p)=>n+(p.externalTotal||0),0);\n    const extDonors = externalPlatforms.reduce((n,p)=>n+(p.externalDonorCount||0),0);\n    const totalHeld = holdingAccounts.reduce((n,a)=>n+(a.totalBalance||0),0);\n    const totalPaidOut = holdingAccounts.reduce((n,a)=>n+(a.totalPaidOut||0),0);\n    const totalFees = holdingAccounts.reduce((n,a)=>n+(a.totalFeesDeducted||0),0);\n    return {\n      localCampaigns:{count:monitoredCampaigns.length+userCampaigns.length,totalRaised:localRaised,totalGoal:localGoal,totalDonors:localDonors,active:monitoredCampaigns.filter(c=>c.status==="active").length+userCampaigns.filter(c=>c.status==="active").length,draft:monitoredCampaigns.filter(c=>c.status==="draft").length},\n      externalPlatforms:{count:externalPlatforms.length,totalRaised:extRaised,totalDonors:extDonors},\n      holdingAccounts:{totalHeld,totalPaidOut,totalFees,netPosition:totalHeld-totalPaidOut-totalFees},\n      grandTotal:{raised:localRaised+extRaised,donors:localDonors+extDonors,held:totalHeld},\n    };\n  },\n});\n\nexport const createAdminDeposit = mutation({\n  args:{sessionToken:v.string(),targetUserId:v.string(),amount:v.number(),sourcePlatform:v.string(),campaignId:v.optional(v.string())},\n  handler:async(ctx,args)=>{\n    const principal=await requireAdminSession(ctx,args.sessionToken,"finance");\n    if(!validateDonation(args.amount)) throw new Error("Deposit amount must be between $0.01 and $100,000");\n    const target=args.targetUserId.trim(); if(!target) throw new Error("Target user is required");\n    const profile=await ctx.db.query("userProfiles").filter(q=>q.eq(q.field("userId"),target)).first();\n    let account=await ctx.db.query("holdingAccounts").filter(q=>q.eq(q.field("userId"),target)).first();\n    if(!profile&&!account) throw new Error("Target user does not exist");\n    const now=new Date().toISOString();\n    const transactionId=await ctx.db.insert("transactions",{userId:target,type:"deposit",amount:args.amount,sourcePlatform:args.sourcePlatform,campaignId:args.campaignId,status:"completed",createdAt:now});\n    if(account) await ctx.db.patch(account._id,{totalBalance:account.totalBalance+args.amount,lastUpdated:now});\n    else await ctx.db.insert("holdingAccounts",{userId:target,totalBalance:args.amount,totalFeesDeducted:0,totalPaidOut:0,pendingPayouts:0,lastUpdated:now});\n    await ctx.db.insert("agentActivityLog",{agentName:principal.name,action:"admin_manual_deposit",category:"treasury",description:\`Manual external-fund deposit recorded for user \${target}.\`,creditCost:0,timestamp:now});\n    return {status:"success",transactionId,depositedAmount:args.amount,targetUserId:target};\n  },\n});\n\nexport const requestAdminPayout = mutation({\n  args:{sessionToken:v.string(),targetUserId:v.string(),payoutMethod:v.string(),payoutDestination:v.string()},\n  handler:async(ctx,args)=>{\n    const principal=await requireAdminSession(ctx,args.sessionToken,"finance");\n    const target=args.targetUserId.trim(); if(!target) throw new Error("Target user is required");\n    checkRateLimit("admin_payout_request",3,300000);\n    const account=await ctx.db.query("holdingAccounts").filter(q=>q.eq(q.field("userId"),target)).first();\n    if(!account||account.totalBalance<=0) throw new Error("Insufficient balance");\n    if(account.frozen) throw new Error("Account is frozen");\n    const feeConfigs=await ctx.db.query("feeConfig").filter(q=>q.eq(q.field("active"),true)).first();\n    const gross=account.totalBalance; const platformFee=gross*((feeConfigs?.platformFeePercent??5)/100); const processingFee=gross*((feeConfigs?.processingFeePercent??2.9)/100)+(feeConfigs?.processingFeeFlat??0.30); const totalFees=platformFee+processingFee; const net=gross-totalFees;\n    const now=new Date().toISOString();\n    const payoutId=await ctx.db.insert("payoutRequests",{userId:target,amountRequested:gross,feeAmount:totalFees,netAmount:net,payoutMethod:args.payoutMethod,payoutDestination:args.payoutDestination,status:"pending",requestedDate:now});\n    await ctx.db.patch(account._id,{pendingPayouts:account.pendingPayouts+gross,totalFeesDeducted:account.totalFeesDeducted+totalFees,lastUpdated:now});\n    await ctx.db.insert("transactions",{userId:target,type:"payout",amount:net,payoutRequestId:payoutId,status:"pending",createdAt:now});\n    await ctx.db.insert("agentActivityLog",{agentName:principal.name,action:"admin_payout_requested",category:"treasury",description:\`Administrative payout requested for user \${target}; super-admin fraud review is still required before completion.\`,creditCost:0,timestamp:now});\n    return {status:"success",payoutId,summary:{availableBalance:\`$\${gross.toFixed(2)}\`,youReceive:\`$\${net.toFixed(2)}\`,ourFee:\`$\${totalFees.toFixed(2)}\`,method:args.payoutMethod,destination:args.payoutDestination}};\n  },\n});\n\n`;
  if(!s.includes('export const getAdminBalances')) s=rep(s,insertBefore,adminApis+insertBefore,'admin treasury APIs');

  s=s.replace(/export const completePayout = mutation\(\{\n  args: \{\n    payoutId: v\.id\("payoutRequests"\),\n    transactionId: v\.optional\(v\.string\(\)\),\n    adminPin: v\.optional\(v\.string\(\)\),\n  \},\n  handler: async \(ctx, args\) => \{\n    if \(args\.adminPin\) \{\n      await requireSuperAdmin\(ctx, args\.adminPin\);\n    \}/,`export const completePayout = mutation({\n  args: {\n    sessionToken: v.string(),\n    payoutId: v.id("payoutRequests"),\n    transactionId: v.optional(v.string()),\n  },\n  handler: async (ctx, args) => {\n    await requireSuperAdminSession(ctx, args.sessionToken);`);

  s=s.replace(/export const updateFeeConfig = mutation\(\{\n  args: \{\n    platformFeePercent: v\.number\(\),\n    processingFeePercent: v\.number\(\),\n    processingFeeFlat: v\.number\(\),\n    updatedBy: v\.string\(\),\n    adminPin: v\.optional\(v\.string\(\)\),\n  \},\n  handler: async \(ctx, args\) => \{/,`export const updateFeeConfig = mutation({\n  args: {\n    sessionToken: v.string(),\n    platformFeePercent: v.number(),\n    processingFeePercent: v.number(),\n    processingFeeFlat: v.number(),\n    updatedBy: v.string(),\n  },\n  handler: async (ctx, args) => {\n    await requireSuperAdminSession(ctx, args.sessionToken);`);
  write(p,s);
}

// Wire all Admin cockpit surfaces to the same session, including finance, fraud, users, and migration.
{
  const p='src/pages/Admin.tsx'; let s=read(p);
  s=rep(s,'const balances = useQuery(api.treasury.aggregateBalances, {});','const balances = useQuery(api.treasury.getAdminBalances, sessionToken ? { sessionToken } : "skip");','admin balances');
  s=rep(s,'const result = await migrateCampaigns({});','const result = await migrateCampaigns({ sessionToken });','migration token');
  s=rep(s,'const requestPayout = useMutation(api.treasury.requestPayout);','const requestPayout = useMutation(api.treasury.requestAdminPayout);','admin payout mutation');
  s=rep(s,'const createDeposit = useMutation(api.treasury.createDeposit);','const createDeposit = useMutation(api.treasury.createAdminDeposit);','admin deposit mutation');
  s=rep(s,'userId: (adminUser as any)?.userId || "",\n        payoutMethod,','sessionToken,\n        targetUserId: treasuryUser,\n        payoutMethod,','admin payout target');
  s=rep(s,'userId: (adminUser as any)?.userId || "",\n        amount: parseFloat(depositAmount) || 0,','sessionToken,\n        targetUserId: treasuryUser,\n        amount: parseFloat(depositAmount) || 0,','admin deposit target');
  s=s.replace('<FraudControl />','<FraudControl sessionToken={sessionToken} />');
  s=s.replace('<UserManagement />','<UserManagement sessionToken={sessionToken} />');
  write(p,s);
}

// Extend the permanent regression verifier to cover the entire admin cockpit.
{
  const p='scripts/verify-admin-session-integration-boundary.mjs'; let s=read(p);
  const extra=`\nconst fraud=read("convex/fraudControl.ts");\nconst fraudUi=read("src/components/FraudControl.tsx");\nconst users=read("convex/userManagement.ts");\nconst usersUi=read("src/components/UserManagement.tsx");\nconst treasury=read("convex/treasury.ts");\nconst protocolFix=read("convex/protocolAutoFix.ts");`;
  s=rep(s,'const perms=read("src/components/PermissionsManager.tsx");','const perms=read("src/components/PermissionsManager.tsx");'+extra,'verifier admin modules');
  const checks=`\nif(fraud.includes("adminPin")||fraudUi.includes("adminPin")||fraudUi.includes("Unlock Fraud Control")) failures.push("fraud control still uses PIN authorization");\nif(!fraud.includes("requireSuperAdminSession")) failures.push("fraud control is not super-admin session protected");\nif(users.includes("adminPin")||usersUi.includes("adminPin")||usersUi.includes("Unlock User Panel")) failures.push("user management still uses PIN authorization");\nif(!users.includes("requireAdminSession")||!users.includes("requireSuperAdminSession")) failures.push("user management session permissions missing");\nif(!treasury.includes("getAdminBalances")||!treasury.includes("createAdminDeposit")||!treasury.includes("requestAdminPayout")) failures.push("admin treasury APIs missing");\nif(!treasury.includes('requireAdminSession(ctx,args.sessionToken,"finance")')&&!treasury.includes('requireAdminSession(ctx, args.sessionToken, "finance")')) failures.push("admin treasury finance authorization missing");\nif(!protocolFix.includes('requireAdminSession(ctx, sessionToken, "campaigns")')) failures.push("mass campaign migration remains unauthenticated");\nif(!page.includes("requestAdminPayout")||!page.includes("createAdminDeposit")||!page.includes("targetUserId: treasuryUser")) failures.push("Admin treasury UI still targets user APIs or wrong identity");\nif(!page.includes("<FraudControl sessionToken={sessionToken} />")||!page.includes("<UserManagement sessionToken={sessionToken} />")) failures.push("Admin child panels are not session wired");`;
  s=rep(s,'if(failures.length){console.error(failures.join("\\n"));process.exit(1)}',checks+'\nif(failures.length){console.error(failures.join("\\n"));process.exit(1)}','verifier full cockpit checks');
  write(p,s);
}

console.log('Applied full admin cockpit session authorization completion');
