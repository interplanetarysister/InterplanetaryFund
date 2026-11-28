import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  isSavedMethodDescriptor,savedMethodsFromResponse,sortSavedMethods,
  formatSavedCard,savedCardExpiry
} from "../src/lib/savedPaymentMethods.mjs";

const component=readFileSync(new URL("../src/components/subscriptions/SavedPaymentMethods.jsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const edge=readFileSync(new URL("../../../supabase/functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261127190000_ifund_saved_payment_methods.sql",import.meta.url),"utf8");

const good={id:"11111111-1111-4111-8111-111111111111",brand:"VISA",last4:"4242",
  expiry_month:3,expiry_year:2028,cardholder_name:"Test User",is_default:false,
  status:"active",created_at:"2026-11-27T00:00:00Z"};

test("Descriptors validate strictly and never carry a card number or CVV",()=>{
  assert.equal(isSavedMethodDescriptor(good),true);
  assert.equal(isSavedMethodDescriptor({...good,last4:"424"}),false);
  assert.equal(isSavedMethodDescriptor({...good,last4:"42424"}),false);
  assert.equal(isSavedMethodDescriptor({...good,expiry_month:13}),false);
  assert.equal(isSavedMethodDescriptor({...good,expiry_year:1999}),false);
  assert.equal(isSavedMethodDescriptor(null),false);
  assert.equal("card_number" in good,false);
  assert.equal("cvv" in good,false);
});
test("Responses are filtered to valid descriptors and sorted default-first",()=>{
  const older={...good,id:"a",is_default:false,created_at:"2026-11-20T00:00:00Z"};
  const newer={...good,id:"b",is_default:false,created_at:"2026-11-25T00:00:00Z"};
  const dflt={...good,id:"c",is_default:true,created_at:"2026-11-01T00:00:00Z"};
  const out=savedMethodsFromResponse({ok:true,methods:[older,{bad:true},newer,dflt]});
  assert.deepEqual(out.map(m=>m.id),["c","b","a"]);
  assert.deepEqual(savedMethodsFromResponse({ok:false,methods:[good]}),[]);
  assert.deepEqual(savedMethodsFromResponse(null),[]);
  assert.deepEqual(sortSavedMethods([older,dflt]).map(m=>m.id),["c","a"]);
});
test("Display formatting shows brand, masked last4 and expiry only",()=>{
  assert.equal(formatSavedCard(good),"VISA •••• 4242");
  assert.equal(savedCardExpiry(good),"Expires 03/2028");
  assert.equal(formatSavedCard(null),"Saved card");
});
test("Add-card flow uses PayPal hosted fields with a vault setup token",()=>{
  assert.match(component,/paypal\.CardFields/);
  assert.match(component,/createVaultSetupToken/);
  assert.match(component,/\/setup-token/);
  assert.match(component,/\/exchange/);
  assert.match(component,/vaultSetupToken/);
  assert.match(component,/card\.NumberField\(\)/);
  assert.match(component,/card\.CVVField\(\)/);
  // Card data must never be held in React state or read from the DOM.
  assert.doesNotMatch(component,/useState\([^)]*card/i);
  assert.doesNotMatch(component,/card_number|cardNumber|cvvValue|security_code/);
});
test("Saved methods section is consolidated into the subscriptions page",()=>{
  assert.match(page,/import SavedPaymentMethods/);
  assert.match(page,/<SavedPaymentMethods \/>/);
  assert.match(component,/\/api\/payments\/saved-methods/);
  assert.match(component,/Set default/);
  assert.match(component,/Remove/);
  assert.match(component,/Default/);
});
test("Worker and ledger implement the Vault v3 token-only contract",()=>{
  assert.match(worker,/\/v3\/vault\/setup-tokens/);
  assert.match(worker,/\/v3\/vault\/payment-tokens/);
  assert.match(worker,/saved_method_record/);
  assert.match(edge,/saved_method_record/);
  assert.match(edge,/saved_method_list/);
  assert.match(edge,/saved_method_delete/);
  assert.match(edge,/saved_method_set_default/);
  assert.match(edge,/resolveVerifiedDonor\(p\.member_access_token\)/);
});
test("Migration stores token references and descriptors, never PAN or CVV",()=>{
  assert.match(sql,/ifund_saved_payment_methods/);
  assert.match(sql,/paypal_payment_token_id text not null unique/);
  assert.match(sql,/last4 text not null check \(last4 ~ '\^\[0-9\]\{4\}\$'\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/auth\.uid\(\)\)=user_id/);
  assert.match(sql,/where is_default and status='active'/);
  // No COLUMN may be capable of holding a card number or CVV (the migration's
  // own warning comments mention them; column definitions must not).
  const ddl=sql.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(ddl,/card_number|cvv|cvc|pan_number|full_card/i);
});
