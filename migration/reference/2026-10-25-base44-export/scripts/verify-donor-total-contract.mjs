import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computePayPalBreakdown, computePayPalWalletBreakdown, computeChargeTotal } from '../base44/shared/fees.js';
for (const pledge of [1,25,50,100,250,999.99]) {
  for (const tip of [false,true]) {
    for (const quote of [computePayPalBreakdown,computePayPalWalletBreakdown]) {
      const b = quote(pledge,tip);
      assert.equal(b.recipientGift,pledge);
      assert.equal(b.contribution,tip ? Math.round(pledge*10)/100 : 0);
      assert.equal(Number((b.amount + b.processing).toFixed(2)),b.totalCharged);
      assert.ok(b.totalCharged > pledge);
    }
  }
}
assert.equal(computeChargeTotal(100),100,'legacy total-rounding helper stays stable');
const create=fs.readFileSync('base44/functions/createPayPalOrder/entry.ts','utf8');
const gpay=fs.readFileSync('src/components/payments/GooglePayButton.jsx','utf8');
const apple=fs.readFileSync('src/components/payments/ApplePayButton.jsx','utf8');
assert.match(create,/const totalCharge = quote.totalCharged/);
assert.match(create,/gift_first_v2/);
assert.match(gpay,/allocation.totalCharged.toFixed\(2\)/);
assert.match(apple,/allocation.totalCharged.toFixed\(2\)/);
assert.match(gpay,/if \(intentRef.current.key !== financialIntentKey\)/);
assert.match(gpay,/intentRef.current = \{ key: financialIntentKey, id: crypto.randomUUID\(\) \}/);

const receipt=fs.readFileSync('base44/shared/sendDonationReceipt.ts','utf8');
const giving=fs.readFileSync('base44/functions/getMyGiving/entry.ts','utf8');
const donorUi=fs.readFileSync('src/components/campaigns/DonateDialog.jsx','utf8');
assert.match(receipt,/const gift = Math.max\(0, Number\(donation.amount \|\| 0\) - contribution\)/);
assert.match(receipt,/const total = Number\(donation.amount \|\| 0\) \+ fee/);
assert.match(giving,/amount: giftOf\(d\)/);
assert.match(giving,/platform_support_amount/);
assert.match(donorUi,/Gift to this campaign/);
assert.doesNotMatch(donorUi,/IF fee at withdrawal \(3%\)/);

console.log('Donor pledge, tip, receipts, historical ledgers and wallet totals passed.');
