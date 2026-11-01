import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const footer = read("src/components/LegalFooter.jsx");
const homepage = read("src/pages/Home.jsx");
const help = read("src/pages/Help.jsx");
const taxonomy = read("src/lib/helpCenter.js");
const terms = read("src/lib/legalPolicy.js");
const acceptance = read("base44/functions/recordLegalAcceptance/entry.ts");
const paypalLink = read("src/lib/paypalLink.js");
const paymentButton = read("src/components/payments/PayPalDonateButton.jsx");
const repoNotice = read("LICENSE");
const readme = read("README.md");

assert.match(footer, /© 2026/);
assert.match(footer, /copyright-and-intellectual-property/);
assert.doesNotMatch(footer, /© 2026 Michelle Rogers/);
assert.match(homepage, /<LegalFooter \/>/);
assert.match(homepage, /Support Interplanetary Fund with PayPal/);
assert.match(taxonomy, /Legal & Policies/);
assert.match(help, /Legal documents & rights/);

for (const slug of [
  "terms-of-service", "privacy-policy", "copyright-and-intellectual-property",
  "campaign-authority-and-ai-permissions", "payment-holding-and-withdrawals",
  "copyright-permissions-and-reporting",
]) assert(help.includes("/help/" + slug), "Legal help link missing: " + slug);

assert(terms.includes("2026-10-13-v3") && acceptance.includes("2026-10-13-v3"));
assert.match(repoNotice, /© 2026 Interplanetary Fund/);
assert.match(readme, /copyright-and-intellectual-property/);
assert.match(paypalLink, /paypal\.com\/ncp\/payment\/VMW5XU3Y46K5J/);
assert.doesNotMatch(paypalLink, /cmd: "_donations"/);
assert.match(paymentButton, /window\.open\(href/);
assert.match(paymentButton, /generatePayPalLink/);
assert.match(read("src/components/campaigns/DonateDialog.jsx"), /PayPalCheckoutButton/);

for (const entity of ["HelpArticle", "HelpDraft"]) {
  const schema = JSON.parse(read("base44/entities/" + entity + ".jsonc"));
  assert(schema.properties.category.enum.includes("Legal & Policies"));
  assert.equal(schema.rls.create.user_condition.role, "admin");
}
assert.deepEqual(JSON.parse(read("base44/entities/HelpArticle.jsonc")).rls.read, {});
console.log("PASS: public legal Help Center links, copyrighted brand footer, versioned terms, PayPal platform-support link and campaign checkout separation.");
