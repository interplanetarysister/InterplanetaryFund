import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const fn = read('base44/functions/getOwnerFinancialLedger/entry.ts');
const page = read('src/pages/FinancialLedger.jsx');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');

assert.match(fn, /FinancialOperation\.filter\(\{ campaign_owner_user_id: user\.id \}/);
assert.match(fn, /HoldingLedgerEntry\.filter\(\{ beneficiary_user_id: user\.id \}/);
assert.match(fn, /Campaign\.filter\(\{ created_by_id: user\.id \}/);
assert.doesNotMatch(fn, /provider_transaction_id:/);
assert.doesNotMatch(fn, /payout_destination_ref:/);
assert.match(fn, /settled_held_available/);
assert.match(page, /getOwnerFinancialLedger/);
assert.match(page, /Only canonical financial operations and verified custody movements appear here/);
assert.match(app, /path="\/ledger" element=\{<FinancialLedger \/>\}/);
assert.match(layout, /to: "\/ledger", label: "Financial Ledger"/);

console.log('owner financial ledger contract: PASS');
