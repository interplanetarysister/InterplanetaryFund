// Pure offline tests. Never captures funds or changes ledgers.
import assert from 'node:assert/strict';
import {
  computeContribution, recipientGift, giftOf, computeWithdrawal,
  computeBreakdown, computePayPalBreakdown, computePayPalWalletBreakdown,
  validateDonationAmount, computePayPalProcessingFee,
} from '../base44/shared/fees.js';
import { computePayPalBreakdown as clientPayPalBreakdown, computePayPalWalletBreakdown as clientWalletBreakdown } from '../src/lib/fees.js';

for (const [rail, quote] of [['PayPal', computePayPalBreakdown], ['PayPal wallet', computePayPalWalletBreakdown], ['Generic', computeBreakdown]]) {
  for (const pledge of [1, 2.75, 25, 33.33, 100, 999.99]) {
    for (const chosen of [false, true]) {
      const b = quote(pledge, chosen);
      const pledgedCents = Math.round(pledge * 100);
      const tipCents = chosen ? Math.round(pledgedCents * .10) : 0;
      assert.equal(b.recipientGift, pledge, rail + ' pledged gift must stay intact');
      assert.equal(b.contribution, tipCents / 100, rail + ' 10% must be additional');
      assert.equal(Math.round(b.totalCharged * 100), Math.round(b.amount * 100) + Math.round(b.processing * 100));
      assert.equal(Math.round(b.amount * 100), pledgedCents + tipCents);
      assert.ok(b.totalCharged >= pledge + (tipCents / 100));
      assert.equal(b.platformFee, computeWithdrawal(pledge).fee, '3% only at withdrawal');
      assert.equal(b.recipientNet, computeWithdrawal(pledge).net);
    }
  }
}
for (const optIn of [false, true]) {
  assert.deepEqual(computePayPalBreakdown(100, optIn), clientPayPalBreakdown(100, optIn));
  assert.deepEqual(computePayPalWalletBreakdown(100, optIn), clientWalletBreakdown(100, optIn));
}
const withTip = computePayPalBreakdown(100, true);
assert.equal(withTip.recipientGift, 100);
assert.equal(withTip.contribution, 10);
assert.ok(withTip.totalCharged > 110, 'processor fee is separately consented to');
assert.equal(computeContribution(100, true), 10);
// Existing stored donation rows are NOT reinterpreted or retroactively rewritten.
assert.equal(giftOf({amount:100,platform_contribution:10}),90);
assert.equal(recipientGift(100,true),90, 'legacy helper retained for saved allocations');
assert.equal(giftOf({amount:100}),100);
assert.equal(giftOf({amount:10,platform_contribution:20}),0);
assert.equal(computeWithdrawal(100).fee,3);
assert.equal(computeWithdrawal(100).net,97);
assert.ok(computePayPalProcessingFee(100)>0);
for (const [amount,allowed] of [[1,true],[100,true],[1_000_000,true],[0,false],[-5,false],[.5,false],[1_000_001,false],[null,false]]) {
  assert.equal(validateDonationAmount(amount).ok,allowed,'amount validation '+amount);
}
console.log('Gift-first quote, legacy donations, 10% opt-in, and withdrawal math passed.');
