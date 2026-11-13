import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { googlePayPage, googlePayScript } from '../worker/googlepay-ui.js';

const handler = readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../sql/20261113_ifund_demo_googlepay_sandbox_checkout_method.sql', import.meta.url), 'utf8');

test('sandbox wallet UI uses valid standalone JavaScript and visually labels fake money', () => {
  assert.doesNotThrow(() => new vm.Script(googlePayScript));
  assert.match(googlePayPage, /SANDBOX ONLY/);
  assert.match(googlePayPage, /FAKE MONEY/);
  assert.match(googlePayPage, /src="\/api\/google-pay\.js"/);
  assert.match(googlePayPage, /Google Pay checkout/);
});

test('the wallet routes bypass SPA asset-first fallback and require same sandbox origin', () => {
  const route = handler.indexOf('path === "/api/google-pay"');
  const assets = handler.indexOf('if (!path.startsWith("/api/"))');
  assert.ok(route >= 0 && assets > route);
  assert.match(handler, /u\.origin !== env\.DEMO_ORIGIN/);
  assert.match(handler, /content-security-policy/);
  assert.match(handler, /judgeGuideHtml\.replace/);
});

test('merchant client id is sandbox-only and member-gated', () => {
  const config = handler.slice(handler.indexOf('path === "/api/google-pay/config"'), handler.indexOf('path === "/api/paypal/orders"'));
  assert.match(config, /requireUser\(user\)/);
  assert.match(config, /env\.DEMO_ENABLED === "true"/);
  assert.match(config, /environment:"sandbox"/);
  assert.doesNotMatch(config, /PAYPAL_CLIENT_SECRET/);
});

test('Google Pay sandbox never routes a wallet to production or bypasses provider capture', () => {
  assert.match(googlePayScript, /environment:'TEST'/);
  assert.match(googlePayScript, /checkout_method:'googlepay'/);
  assert.match(googlePayScript, /gateway\.confirmOrder/);
  assert.match(googlePayScript, /gateway\.initiatePayerAction/);
  assert.match(googlePayScript, /result\.status!=='captured'/);
  assert.match(googlePayScript, /result\.capture_id/);
  assert.match(googlePayScript, /api\/paypal\/orders/);
  assert.match(handler, /"googlepay"/);
  assert.match(migration, /'paypal','card','googlepay'/);
});
