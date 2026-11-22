import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const worker=read("../../../workers/ifund-payments/worker.js");
const edge=read("../../../supabase/functions/ifund-payment-ledger/index.ts");
const ui=read("../src/components/payments/PlatformSupportDonationDialog.jsx");
const inbox=read("../src/lib/inbox.js");
const sql=read("../../../supabase/migrations/20261121194500_ifund_platform_support_checkout.sql");
test("platform support uses dedicated create and capture routes",()=>{
 assert.match(worker,/create-platform-support-order/);assert.match(worker,/capture-platform-support-order/);
 assert.match(worker,/platform_begin/);assert.match(worker,/platform_finalize/);
});
test("platform support is accounted separately from campaign donations",()=>{
 assert.match(sql,/ifund_platform_support_donations/);assert.match(sql,/ifund_platform_support_ledger_entries/);
 assert.match(worker,/IFUND-PLATFORM/);assert.match(edge,/ifund_finalize_verified_platform_support_capture/);
});
test("platform messages are admin-only and created after verified capture",()=>{
 assert.match(sql,/p_capture_status is distinct from 'COMPLETED'/);
 assert.match(sql,/ifund_platform_support_messages/);assert.match(sql,/app_metadata/);assert.match(sql,/security invoker/);assert.match(sql,/private\.ifund_notify_platform_support_admins/);
 assert.match(inbox,/ifund_platform_support_messages/);
});
test("platform UI does not require donor or cardholder name and does not fake unavailable rails",()=>{
 assert.match(ui,/Name on card \(optional\)/);assert.match(ui,/card\.NameField\(\)\.render\(nameHost\.current\)/);
 assert.match(ui,/IFund does not require your name/);
 assert.match(ui,/Cash App and bank transfer are not enabled/);assert.match(ui,/GooglePayDonationButton/);
});
