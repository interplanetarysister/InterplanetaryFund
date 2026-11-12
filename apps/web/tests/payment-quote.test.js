import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { paymentQuoteCents } from "../src/lib/paymentQuote.js";

const workerSource = readFileSync(new URL("../../../workers/ifund-payments/worker.js", import.meta.url), "utf8");
const serverQuote = vm.runInNewContext(workerSource.replace("export default {", "globalThis.__paymentWorker = {") + "\nquote", { URL, TextEncoder, Response, Request });

test("donor charge matches the production Worker quote in integer cents", () => {
  for (const gift of [100, 250, 333, 500, 1000, 2500, 9999, 100000]) {
    for (const support of [0, Math.round(gift * 0.1)]) {
      for (const channel of ["paypal", "card", "applepay", "googlepay"]) {
        const estimate = paymentQuoteCents(gift, support, channel);
        assert.equal(estimate.totalCents, serverQuote(gift, support, channel),
          `gift=${gift},support=${support},channel=${channel}`);
        assert.equal(estimate.totalCents, estimate.giftCents + estimate.optionalSupportCents + estimate.processingCents);
        assert.equal(estimate.processingCents, 0, "PayPal acceptance must not surcharge the donor");
      }
    }
  }
});

test("invalid quote inputs do not produce charge estimates", () => {
  for (const [gift,tip] of [[99,0],[NaN,0],[100,11],[100,-1],[100,1.1]]) {
    assert.equal(paymentQuoteCents(gift,tip), null);
  }
});

test("checkout UI shows processing charges before provider approval", () => {
  const src=readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
  assert.match(src, /paymentQuoteCents\(gift, tip\)/);
  assert.match(src, /PayPal processing surcharge/);
  assert.match(src, /Total you approve in PayPal/);
  assert.match(src, /IFund covers payment processing costs/);
  assert.match(src, /7% IFund platform fee is deducted from the organizer/);
  assert.match(src, /data\.amount_cents!==paymentQuoteCents\(gift,tip,channel\)\?\.totalCents/);
  assert.match(src, /The payment charge changed/);
  assert.doesNotMatch(src, /Today's total/);
});

test("PayPal order has itemized gift and optional support without a mandatory surcharge", () => {
  assert.match(workerSource, /function paypalOrderBreakdown\(gift,tip\)/);
  assert.match(workerSource, /name:"IFund campaign gift"/);
  assert.match(workerSource, /name:"Optional IFund support"/);
  assert.match(workerSource, /breakdown:\{item_total:amount\}/);
  assert.match(workerSource, /\.\.\.paypalOrderBreakdown\(gift,tip\)/);
});
