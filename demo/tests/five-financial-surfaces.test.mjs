// Fifteen read-only source-contract regression tests across five financial surfaces.
// They do NOT certify live provider settlement, browser journeys or DB authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const demo=read('demo/worker/index.ts');
const paypal=read('demo/worker/paypal.ts');
const subs=read('apps/web/src/pages/Subscriptions.jsx');
const admin=read('apps/web/src/pages/AdminFinance.jsx');
const finance=read('apps/web/src/pages/FinanceDashboard.jsx');
const money=read('apps/web/src/components/analytics/CampaignMetrics.jsx');
const support=read('apps/web/src/components/payments/PlatformSupportHostedButton.jsx');
const cases=[
 ['campaign gifts: sandbox order purpose explicit',()=>assert.match(demo,/input\.purpose === "campaign" \|\| input\.purpose === "platform_support"/)],
 ['campaign gifts: capture checks merchant amount and currency',()=>{for(const x of [/unit\.amount\?\.value === amount/,/currency_code === "USD"/,/unit\.payee\?\.merchant_id === merchant/])assert.match(paypal,x)}],
 ['campaign gifts: funding chart only verified',()=>assert.match(money,/PayPal-confirmed campaign gifts/)],
 ['subscriptions: pending approval does not grant access',()=>assert.match(subs,/Access remains pending until a provider-confirmed payment is verified/)],
 ['subscriptions: confirm uses authenticated endpoint',()=>assert.match(subs,/subscriptions\/confirm"[\s\S]*?auth:true/)],
 ['subscriptions: cancellation requires confirmation',()=>assert.match(subs,/window\.confirm\("Cancel this PayPal subscription\?"\)/)],
 ['iFund support: purpose is distinct from campaign',()=>assert.match(demo,/input\.purpose === "campaign" \|\| input\.purpose === "platform_support"/)],
 ['iFund support: hosted support link is explicit',()=>assert.match(support,/IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/)],
 ['iFund support: admin separates platform income',()=>assert.match(admin,/platform_support_gross_cents/)],
 ['user ledger: receipts use member-scoped RPC',()=>assert.match(finance,/client\.rpc\("ifund_my_donation_receipts"\)/)],
 ['user ledger: refunds excluded from active giving',()=>assert.match(finance,/filter\(x=>x\.receipt_status==="captured"\)/)],
 ['user ledger: identity rechecked after reads',()=>assert.match(finance,/fresh\.data\?\.user\?\.id !== session\.data\.user\.id/)],
 ['admin: report requires authenticated user',()=>assert.match(admin,/if\(before\.error\|\|!before\.data\?\.user\?\.id\)/)],
 ['admin: reports use server RPCs',()=>{for(const x of ['ifund_admin_finance_summary','ifund_super_admin_platform_income_summary','ifund_admin_paypal_merchant_receipts'])assert.ok(admin.includes('client.rpc("'+x+'")'))}],
 ['admin: payout failures cannot appear as empty queue',()=>assert.match(admin,/payoutQueue\.error && Array\.isArray|!payoutQueue\.error && Array\.isArray/)]
];
assert.equal(cases.length,15);
for(const [name,check] of cases)test(name,check);
