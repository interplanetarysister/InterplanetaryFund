import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const demo=readFileSync(new URL("../src/pages/HackathonDemo.jsx",import.meta.url),"utf8");
const gateway=readFileSync(new URL("../functions/api/paypal/sandbox/[[path]].js",import.meta.url),"utf8");

test("sandbox demo clearly distinguishes buyer from receiving merchant",()=>{
  assert.match(demo,/Personal sandbox buyer/);
  assert.match(demo,/Business sandbox merchant/);
  assert.match(demo,/account is associated with the merchant/);
  assert.match(demo,/developer\.paypal\.com\/sandbox-testing\/accounts/);
  assert.match(demo,/same browser session/);
  assert.match(demo,/https:\/\/www\.sandbox\.paypal\.com/);
  assert.doesNotMatch(demo,/sb-[a-z0-9]+@personal\.example\.com/i,
    "do not hardcode sandbox buyer identities into public application");
});

test("sandbox order creation accepts only PayPal Sandbox approval links",()=>{
  assert.match(gateway,/\["sandbox\.paypal\.com","www\.sandbox\.paypal\.com"\]/);
  assert.match(gateway,/approval_url:approval\.href/);
  assert.match(demo,/u\.hostname!=="www\.sandbox\.paypal\.com"/);
  assert.match(demo,/window\.location\.assign\(u\.href\)/);
});
