import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {premiumCardErrorMessage,premiumPurchaseState} from "../src/lib/premiumCardCheckoutFeedback.mjs";
const ui=readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx",import.meta.url),"utf8");
test("Invalid hosted card fields do not claim a PayPal receipt problem",()=>{
 assert.match(premiumCardErrorMessage({stage:"invalid"}),/Check the card number/);
 assert.match(premiumCardErrorMessage({stage:"fields",hasOrder:false}),/No payment order was created/);
 assert.doesNotMatch(premiumCardErrorMessage({stage:"fields",hasOrder:false}),/receipt/i);
});
test("Pending paid orders must be reconciled before initiating a second charge",()=>{
 assert.match(premiumCardErrorMessage({stage:"capture",hasOrder:true}),/Check your Premium purchase status/);
 assert.match(premiumCardErrorMessage({providerCode:"PREMIUM_EXISTING_PURCHASE_REVIEW_REQUIRED",hasOrder:false}),/previous Premium checkout/i);
 assert.equal(premiumPurchaseState({status:"created"}),"pending");
 assert.equal(premiumPurchaseState({status:"initiated"}),"pending");
 assert.equal(premiumPurchaseState({status:"refunded"}),"reversed");
 assert.equal(premiumPurchaseState({status:"captured",valid_until:"2000-01-01T00:00:00Z"}),"none");
 assert.equal(premiumPurchaseState({status:"captured",valid_until:"2099-01-01T00:00:00Z"}),"active");
});
test("Auth and merchant failures are actionable without leaking provider or card data",()=>{
 assert.match(premiumCardErrorMessage({providerCode:"PREMIUM_VERIFIED_MEMBER_REQUIRED"}),/email verification/);
 assert.match(premiumCardErrorMessage({providerCode:"PREMIUM_MERCHANT_AUTHORIZATION_UNAVAILABLE"}),/merchant authorization/);
 assert.match(premiumCardErrorMessage({providerCode:"PREMIUM_PROVIDER_PAYMENT_UNAVAILABLE"}),/could not start/);
 assert.doesNotMatch(ui,/Unable to submit card\. Check receipt before retrying/);
});
test("PayPal card fields are validated before submitting; status is member-authenticated",()=>{
 const stateIndex=ui.indexOf("cardSession.current.getState()");
 const submitIndex=ui.indexOf("await cardSession.current.submit()");
 assert.ok(stateIndex>=0&&submitIndex>stateIndex);
 assert.match(ui,/!state\?\.isFormValid/);
 assert.match(ui,/API\+"\/status"/);
 assert.match(ui,/authorization:"Bearer "\+await memberToken\(\)/);
 assert.match(ui,/purchaseState==="pending"/);
 assert.match(ui,/setComplete\(result.valid_until\)/);
 assert.match(ui,/data\?\.orderID!==intent.current.orderId/);
 assert.match(ui,/premiumCardErrorMessage/);
 assert.match(ui,/!cardReady\|\|busy/);
 assert.doesNotMatch(ui,/fetch\([^)]*paypal\.com\/v2\/checkout/);
});
