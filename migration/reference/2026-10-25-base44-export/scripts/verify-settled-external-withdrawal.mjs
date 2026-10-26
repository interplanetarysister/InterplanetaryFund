import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };

const financial = read('base44/shared/base44Financial.ts');
const withdrawal = read('base44/functions/requestWithdrawal/entry.ts');
const schema = read('base44/entities/Withdrawal.jsonc');
const balanceFunction = read('base44/functions/getCampaignWithdrawalBalance/entry.ts');
const withdrawalsPage = read('src/pages/Withdrawals.jsx');
const kofiWebhook = read('base44/functions/kofiWebhook/entry.ts');

expect(financial.includes("source_type: 'external_platform'"), 'canonical balance must include only verified external-platform settlements');
expect(financial.includes("state: 'settled'"), 'external custody must be settled before becoming available');
expect(financial.includes("currentWithdrawalId"), 'canonical reservation must include the current withdrawal local lock');
expect(financial.includes("args.withdrawalId || ''"), 'reservation must pass current withdrawal identity');

expect(withdrawal.includes('covered_holding_entry_ids'), 'withdrawal must record covered external settlement entries');
expect(withdrawal.includes("beneficiary_user_id: user.id"), 'withdrawal must restrict external funds to the campaign owner');
expect(withdrawal.includes("source_type: 'external_platform'"), 'withdrawal must not double-count direct IFund payment holdings');
expect(withdrawal.includes("withdrawalId: withdrawal.id"), 'canonical reservation must bind to the local withdrawal lock');
expect(withdrawal.includes('Donations and external funds become withdrawable only after verification and settlement.'), 'user copy must preserve custody truth');

expect(schema.includes('"covered_holding_entry_ids"'), 'withdrawal schema must persist covered settlement entries');
expect(balanceFunction.includes("external_settled_available"), 'owner balance endpoint must expose settled external availability');
expect(balanceFunction.includes("beneficiary_user_id: campaign.created_by_id"), 'owner balance endpoint must scope external custody to the campaign beneficiary');
expect(withdrawalsPage.includes('getCampaignWithdrawalBalance'), 'withdrawals UI must use the server-authoritative balance summary');
expect(withdrawalsPage.includes('settled external funds'), 'withdrawals UI must identify included external settlements truthfully');
expect(financial.includes('observationId: observation.id'), 'canonical external observations must return the mirror id used by webhook side effects');
expect(financial.includes('observedTotal'), 'canonical external observations must return an absolute observed total');
expect(financial.includes('observedCount'), 'canonical external observations must return an absolute observed count');
expect(financial.includes("ExternalFundObservation.create"), 'canonical external observations must create their custody-matching provenance mirror');
expect(kofiWebhook.includes('observation.observationId'), 'Ko-fi webhook must consume the canonical observation mirror id');

console.log('settled external withdrawal contract: PASS');