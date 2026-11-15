import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../src/lib/nativeApi.js", import.meta.url), "utf8");

test("native shell avoids loading PayPal SDK, card fields or claiming a completed gift", () => {
  assert.match(source, /import \{ isNativeBundle \} from "@\/lib\/nativeApi"/);
  assert.match(source, /const nativeCheckoutUnavailable = isNativeBundle\(\)/);
  assert.match(source, /if\(nativeCheckoutUnavailable\)return;/);
  assert.match(source, /if \(nativeCheckoutUnavailable\) return \(/);
  assert.match(source, /Mobile donations are not available yet/);
  assert.match(source, /No payment/);
  assert.match(source, /to="\/giving"/);
  const payPalEffect = source.indexOf("const paypal=await loadPayPal");
  const failClosed = source.indexOf("if(nativeCheckoutUnavailable)return;");
  assert.ok(failClosed >= 0 && failClosed < payPalEffect);
  assert.match(native, /native_checkout_requires_approval/);
});

test("normal website PayPal checkout logic is retained in source", () => {
  assert.match(source, /paypal\.Buttons\(/);
  assert.match(source, /paypal\.CardFields/);
  assert.match(source, /\/api\/payments\/capture-order/);
});
