import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const checkout=readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx",import.meta.url),"utf8");
const chooser=readFileSync(new URL("../src/components/subscriptions/PremiumBillingChoices.jsx",import.meta.url),"utf8");
const creator=readFileSync(new URL("../src/pages/WhatIfStart.jsx",import.meta.url),"utf8");

test("direct card entry is the default one-time checkout for Premium",()=>{
 assert.match(chooser,/initialBillingChoice\("card"\)/);
 assert.match(chooser,/<PremiumOneTimeCheckout key=\{choice\.method\}/);
 assert.match(chooser,/Enter my card number instead/);
 assert.match(checkout,/aria-label="Secure one-time card fields"/);
 assert.match(checkout,/card\.NumberField\(\)/);
 assert.match(checkout,/card\.ExpiryField\(\)/);
 assert.match(checkout,/card\.CVVField\(\)/);
 assert.match(checkout,/cardSession\.current\.submit\(\)/);
});
test("subscription card fields use their own PayPal SDK instance",()=>{
 assert.match(checkout,/data-namespace/);
 assert.match(checkout,/PREMIUM_SDK_NAMESPACE/);
 assert.doesNotMatch(checkout,/if\(window\.paypal\?\.Buttons/);
 assert.match(checkout,/components=buttons,card-fields/);
});
test("both embedded checkouts require only three hosted card fields",()=>{
 const donation=readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
 for(const source of [checkout,donation]){
   assert.match(source,/card\.NumberField\(\)/);
   assert.match(source,/card\.ExpiryField\(\)/);
   assert.match(source,/card\.CVVField\(\)/);
   assert.doesNotMatch(source,/NameField\(|nameHost/);
   assert.match(source,/cardSession\.current\.submit\(\)/);
 }
});
test("subscription card availability has an explicit retry and charge remains verified",()=>{
 assert.match(checkout,/Retry secure card checkout/);
 assert.match(checkout,/Pay \$4\.99 by card now/);
 assert.match(checkout,/capture-order/);
 assert.match(checkout,/result\.status!=="captured"/);
});
test("Stitch creation phase keeps private missions and accessible progress",()=>{
 assert.match(creator,/New Missions are private/);
 assert.match(creator,/ifund-interactive/);
});
