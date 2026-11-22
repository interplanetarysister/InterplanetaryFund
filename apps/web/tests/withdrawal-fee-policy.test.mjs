import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteWithdrawalFee } from "../src/lib/withdrawalFeeQuote.mjs";
import { planCampaignBudget, PLATFORM_WITHDRAWAL_FEE_RATE } from "../src/lib/budgetPlanning.mjs";

const migration=readFileSync(new URL("../../../supabase/migrations/20261121200000_ifund_three_percent_withdrawal_fee.sql",import.meta.url),"utf8");
const dialog=readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
const terms=readFileSync(new URL("../src/pages/AuthPage.jsx",import.meta.url),"utf8");
const withdrawal=readFileSync(new URL("../src/pages/WithdrawalVerification.jsx",import.meta.url),"utf8");
const admin=readFileSync(new URL("../src/pages/AdminFinance.jsx",import.meta.url),"utf8");

test("campaign owner withdrawal quote is 3 percent and rounded half-up in integer cents",()=>{
  const quote=quoteWithdrawalFee("100.00");
  assert.deepEqual(quote,{gross_cents:10000,platform_fee_cents:300,estimated_owner_cents:9700});
  assert.equal(quoteWithdrawalFee("0.99").platform_fee_cents,3);
  assert.equal(PLATFORM_WITHDRAWAL_FEE_RATE,0.03);
});

test("budget planner grosses up targets using the 3 percent withdrawal fee",()=>{
  const plan=planCampaignBudget([{label:"Community supplies",amount:"100.00"}]);
  assert.equal(plan.ready,true);
  assert.equal(plan.suggestedGrossCents,10310);
  assert.equal(plan.platformFeeEstimateCents,309);
});

test("new withdrawal reservations record 300 basis points while preserving any historical rate",()=>{
  assert.match(migration,/platform_fee_bps smallint/);
  assert.match(migration,/platform_fee_bps set default 300/);
  assert.match(migration,/platform_fee_bps in \(300,700\)/);
  assert.match(migration,/when platform_fee = round\(gross_amount \* 0\.07, 2\) then 700/);
  const requestStart=migration.indexOf("CREATE OR REPLACE FUNCTION public.ifund_request_withdrawal");
  const prepareStart=migration.indexOf("CREATE OR REPLACE FUNCTION public.ifund_internal_prepare_paypal_payout");
  const recordStart=migration.indexOf("CREATE OR REPLACE FUNCTION public.ifund_internal_record_payout_state");
  const request=migration.slice(requestStart,prepareStart);
  const prepare=migration.slice(prepareStart,recordStart);
  assert.match(request,/v_fee:=round\(p_gross_cents::numeric\*0\.03\)::bigint/);
  assert.match(request,/300,v_fee::numeric\/100/);
  assert.doesNotMatch(request,/0\.07/);
  assert.match(prepare,/w\.platform_fee_bps not in \(300,700\)/);
  assert.match(prepare,/w\.platform_fee_bps\/10000/);
  assert.doesNotMatch(prepare,/0\.07/);
  assert.match(migration,/Realized IFund %s%% withdrawal fee/);
});

test("donor checkout and legal copy show the fee only at owner withdrawal",()=>{
  assert.match(dialog,/3% IFund platform fee is deducted from the organizer's eligible withdrawal/);
  assert.match(terms,/current 3% campaign withdrawal fee/);
  assert.match(withdrawal,/current 3% IFund fee is deducted from campaign gifts at withdrawal/);
  assert.match(admin,/Realized withdrawal fees/);
});
