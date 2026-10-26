import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const campaign = JSON.parse(read("base44/entities/Campaign.jsonc"));
const create = read("src/pages/CreateCampaign.jsx");
const update = read("base44/functions/updateCampaignSettings/entry.ts");
const save = read("base44/functions/saveCampaign/entry.ts");
const detail = read("src/pages/CampaignDetail.jsx");
const donate = read("src/components/campaigns/DonateDialog.jsx");
const home = read("src/pages/Home.jsx");
const crypto = read("src/components/payments/CryptoDonateOption.jsx");
const readiness = read("base44/functions/getCryptoDonationReadiness/entry.ts");
const wallet = read("src/lib/reownWallet.js");
const packageJson = JSON.parse(read("package.json"));

assert.equal(campaign.properties.accept_crypto_donations.default, false, "creator opt-in is off by default");
assert.match(create, /accept_crypto_donations/, "campaign wizard persists opt-in");
assert.match(save, /accept_crypto_donations/, "server save persists opt-in");
assert.match(update, /accept_crypto_donations/, "authorized campaign settings persist opt-in");
assert.match(detail, /CryptoCampaignSettings/, "existing campaign owners can change preference");
assert.match(donate, /CryptoDonateOption campaign=\{campaign\}/, "campaign checkout respects opt-in");
assert.match(donate, /CryptoDonateOption platformSupport/, "platform mode shows distinct crypto support");
assert.match(home, /Cryptocurrency donations — Coming soon/, "homepage must not promise unverified live crypto payments");
assert.doesNotMatch(home, /CryptoDonateOption platformSupport/, "homepage must not expose a non-settling platform crypto checkout");
assert.match(crypto, /optedIn = platformSupport \|\| campaign\?\.accept_crypto_donations === true/, "inactive campaigns are hidden");
assert.match(readiness, /verified_checkout_live: false/, "no unverified live receipt route");
assert.match(readiness, /settlement_ready: false/, "no unverified settlement");
assert.doesNotMatch(crypto, /sendTransaction|writeContract|recordDonation|\.Donation\.create|asServiceRole/, "wallet connection never credits ledger or sends");
assert.doesNotMatch(wallet, /sendTransaction|writeContract|\.transfer\(/, "wallet modal never starts a transfer");
for (const packageName of ["@reown/appkit","@reown/appkit-adapter-ethers","@reown/appkit-adapter-solana","@reown/appkit-adapter-bitcoin"]) {
  assert.ok(packageJson.dependencies[packageName], `dependency missing: ${packageName}`);
}
console.log("PASS: crypto creator opt-in, IFund-specific support, Reown wallet integration, and fail-closed payment integrity.");
