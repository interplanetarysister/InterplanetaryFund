import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ui = read("src/components/ops/FundMigrationDashboard.jsx");
const fn = read("base44/functions/recordExternalFundMigration/entry.ts");
const schema = read("base44/entities/ExternalFundMigrationRecord.jsonc");
const fraud = read("src/components/platform/FraudControlPanel.jsx");

assert.match(ui, /functions\.invoke\("recordExternalFundMigration"/);
assert.match(ui, /ExternalFundMigrationRecord\.filter\(\{ state: "recorded" \}\)/);
assert.doesNotMatch(ui, /PAYOUT_OPTIONS|payoutMethod|payoutDest|bc1qfg|\$unrewound|interplanetarysister@gmail\.com/);
assert.match(ui, /No payout destination is stored or selected here/);
assert.match(ui, /only verified settled funds enter IFund custody/);

assert.match(fn, /user\.role!==["']admin["']/);
assert.match(fn, /ExternalFundMigrationRecord\.filter\(\{request_id:requestId\}\)/);
assert.match(fn, /ExternalFundMigrationRecord\.create/);
assert.doesNotMatch(fn, /Withdrawal\.create/);
assert.doesNotMatch(fn, /paypal_email|payout_destination|payout_method/);
assert.match(fn, /state:"recorded"/);
assert.match(fn, /does not represent provider verification, IFund custody, withdrawal eligibility, or a payout/);
assert.match(fn, /gross\*0\.03/);
assert.match(schema, /not a withdrawal, payout, settlement, or proof of custody/);
assert.match(fraud, /canonical_reservation_id && !!row\.paypal_email/);

console.log("External fund migration reconciliation contract verified.");
