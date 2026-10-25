// Static release contract for the Stripe webhook financial boundary.
// Live provider integration is verified separately; this test prevents
// regressions back to Base44 read-check-create/$inc accounting.
import { readFileSync } from 'node:fs';

const source = readFileSync('base44/functions/stripeWebhook/entry.ts', 'utf8');
const mirrors = readFileSync('base44/shared/financialMirrors.ts', 'utf8');
const checks = [
  ['validates Stripe signature', source.includes("return Response.json({ error: 'Invalid signature' }, { status: 400 });")],
  ['rejects Stripe test-mode events from production financial state', /event\.livemode !== true/.test(source)],
  ['uses signed event id for recovery identity', /eventKey\s*=\s*`stripe:\$\{event\.id\}`/.test(source)],
  ['retains explicit financial_applied recovery state', source.includes("state: 'financial_applied'")],
  ['marks side effects complete only after reconciliation', source.includes("state: 'side_effects_complete'")],
  ['retains failed state for Stripe retry', source.includes("state: 'failed'")],
  ['does not delete webhook recovery record on failure', !/WebhookEvent\.delete\(claim\.id\)/.test(source)],
  ['routes financial value through the canonical Base44 financial boundary', source.includes('recordCanonicalDonation')],
  ['campaign totals are recomputed after Donation mirror convergence',
    !source.includes('mirrorCanonicalCampaignTotal') &&
    mirrors.indexOf('const mirror = await reconcileOne(sr.entities.Donation') >= 0 &&
    mirrors.indexOf('const mirror = await reconcileOne(sr.entities.Donation') <
    mirrors.indexOf('await reconcileCanonicalCampaignProjection(sr, campaignId)')],
  ['repairs Donation mirror by canonical operation id', source.includes('reconcileDonationMirror')],
  ['repairs Notification mirror by canonical operation id', source.includes('reconcileNotificationMirror')],
  ['does not directly create Base44 Donation', !/entities\.Donation\.create/.test(source)],
  ['does not increment Base44 campaign financial counters', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(source)],
  ['operation key uses provider object type', /stripe:\$\{providerObjectKind\}:\$\{providerObjectId\}/.test(source)],
  ['initial checkout uses session identity', /providerObjectKind:\s*'session'/.test(source)],
  ['initial recurring state comes from Stripe metadata', /isRecurring:\s*m\.is_recurring\s*===\s*'true'/.test(source)],
  ['renewal uses invoice identity', /providerObjectKind:\s*'invoice'/.test(source)],
  ['renewal is explicitly recurring', /providerObjectKind:\s*'invoice'[\s\S]*?isRecurring:\s*true/.test(source)],
  ['checks charged amount against server-created metadata', source.includes('Stripe charged amount does not match server-created donation metadata.')],
  ['safe outer error does not expose raw exception', source.includes("return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { console.error(`FAIL ${name}`); failed++; }
  else console.log(`ok  ${name}`);
}

if (failed) {
  console.error(`\n${failed} Stripe financial-integrity contract test(s) failed.`);
  process.exit(1);
}
console.log('\nAll Stripe financial-integrity contract tests passed.');
