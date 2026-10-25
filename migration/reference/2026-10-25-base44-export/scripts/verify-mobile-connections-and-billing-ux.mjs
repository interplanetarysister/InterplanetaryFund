import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const chat = read("src/components/agents/AgentChat.jsx");
const dialog = read("src/components/connections/ConnectDialog.jsx");
const agentActivity = read("src/components/connections/AgentWorkPanel.jsx");
const connections = read("src/pages/Connections.jsx");
const home = read("src/pages/Home.jsx");
const css = read("src/index.css");
const plans = read("src/pages/Subscriptions.jsx");
const billing = read("base44/functions/getPayPalSubscriptionOptions/entry.ts");
const webhook = read("base44/functions/setupPayPalSubscriptionWebhook/entry.ts");

assert.match(chat, /createPortal\(composer, document\.body\)/, "mobile composer must escape the animated, clipped page");
assert.match(chat, /sm:h-\[min\(68dvh,40rem\)\]/, "chat must use a bounded flex workspace on larger viewports");
assert.match(chat, /bottom-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/, "mobile composer must clear bottom navigation");
assert.match(chat, /pl-14 text-foreground/, "mobile composer must clear Quick Actions");
assert.match(chat, /overflow-y-auto overscroll-y-contain touch-pan-y/, "conversation history must support touch scrolling");
assert.match(dialog, /max-h-\[calc\(100dvh-1\.5rem\)\]/, "connection dialog must fit the mobile viewport");
assert.match(dialog, /setOauthReadiness\("not_configured"\)|"not_configured"/, "show missing IFund provider setup separately from user sign-in failure");
assert.match(dialog, /registration_unverified/, "a connector registration must not be presented as proven operational readiness");
assert.doesNotMatch(dialog, /data\?\.configured && data\?\.connector_id \? "ready"/, "an environment connector id alone must not become ready");
assert.doesNotMatch(dialog, /void connectWithProvider\(\)/, "provider deep links require a deliberate user click inside IFund");
assert.match(agentActivity, /to=\{`\/connections\?connect=\$\{encodeURIComponent/, "account setup must link to IFund, not the provider homepage");
assert.doesNotMatch(agentActivity, /href=\{officialProviderSite/, "activity must not bypass IFund connection authorization");
assert.match(connections, /setDialog\(\{ platform, existing \}\)/, "provider deep links must open IFund connection window");
assert.match(home, /Cryptocurrency donations — Coming soon…/, "homepage must use short crypto coming-soon copy");
for (const surface of ["bg-violet-50", "bg-cyan-50", "bg-sky-50", "bg-amber-50"]) {
  assert.ok(css.includes(`.dark [class~="${surface}"]`), `dark mode must contrast text on ${surface} cards`);
}
assert.match(plans, /Saved PayPal price mappings:/, "admin must see catalog records independently");
assert.match(plans, /Checkout-ready prices:/, "admin must see provider-verified readiness independently");
assert.match(billing, /saved_plan_mapping_count: savedMappingCount/, "backend must expose non-secret mapped catalog count for admin");
assert.match(billing, /webhook_not_verified/, "backend must not mislabel missing webhook as missing plans");
assert.match(webhook, /stage = 'register_paypal_webhook'/, "admin setup must identify failing stage safely");

console.log("Mobile AI chat, platform sign-in, and PayPal billing UX regression contract passed.");
