// Static contract tests for the server-side account-revocation guard.
// Asserts the guard helper covers pending/disabled/deleted states and that
// every sensitive authenticated function imports and calls it.
import { readFileSync } from 'node:fs';

const guard = readFileSync('base44/shared/accountGuard.ts', 'utf8');
let failed = 0;
const ok = (n, c) => { if (!c) { console.error(`FAIL ${n}`); failed++; } else { console.log(`ok  ${n}`); } };

// --- The guard helper itself ---
ok('guard rejects pending deletion', guard.includes('account_deletion_pending'));
ok('guard rejects non-active account_status', guard.includes("account_status !== 'active'"));
ok('guard rejects absent user (deleted)', guard.includes('!fresh'));
ok('soft guard allows unsigned callers', guard.includes('if (!donor) return { ok: true, donor: null }'));
ok('guard re-reads the user via the service role', guard.includes('asServiceRole') && guard.includes('entities.User.get'));

// --- Every sensitive authenticated function must apply the guard ---
const REQUIRED = [
  ['recordDonation', 'assertActiveAccountIfSignedIn'],
  ['capturePayPalOrder', 'assertActiveAccountIfSignedIn'],
  ['createPayPalOrder', 'assertActiveAccountIfSignedIn'],
  ['requestWithdrawal', 'assertActiveAccount'],
  ['postCampaignUpdate', 'assertActiveAccount'],
  ['publishPost', 'assertActiveAccount'],
  ['broadcastPosts', 'assertActiveAccount'],
  ['generateDistributionContent', 'assertActiveAccount'],
  ['decideGrantApplication', 'assertActiveAccount'],
];
for (const [fn, helper] of REQUIRED) {
  const src = readFileSync(`base44/functions/${fn}/entry.ts`, 'utf8');
  ok(`${fn} imports ${helper}`, src.includes("from '../../shared/accountGuard.ts'") && src.includes(helper));
  ok(`${fn} invokes the guard`, src.includes(`await ${helper}(`));
  ok(`${fn} no longer bypasses status with a bare auth.me check`, !/const user = await base44\.auth\.me\(\);[\s\S]{0,120}if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/.test(src));
}

for (const fn of ['createDonationCheckout','createSubscriptionCheckout']) {
  const src = readFileSync(`base44/functions/${fn}/entry.ts`, 'utf8');
  ok(`${fn} denies new purchases after retirement`, src.includes('status: 410'));
}

// runOutreachAgent is service-scoped (no caller) — it must skip revoked owners.
const roa = readFileSync('base44/functions/runOutreachAgent/entry.ts', 'utf8');
ok('runOutreachAgent skips revoked owners', roa.includes('account_deletion_pending') && roa.includes('owner account unavailable'));

// stripeWebhook is unauthenticated (Stripe webhook) — must NOT require the guard.
const sw = readFileSync('base44/functions/stripeWebhook/entry.ts', 'utf8');
ok('stripeWebhook does not require auth', !sw.includes('assertActiveAccount'));

// deleteAccount must mark account_status disabled on the anonymize fallback and
// document that built-in identity is retained by the platform.
const da = readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
ok('deleteAccount disables on anonymize', da.includes("account_status: 'disabled'"));
ok('deleteAccount documents built-in identity retention', da.includes('cannot be cleared by the application'));

if (failed) { console.error(`\n${failed} account-guard test(s) failed.`); process.exit(1); }
console.log('\nAll account-guard tests passed.');