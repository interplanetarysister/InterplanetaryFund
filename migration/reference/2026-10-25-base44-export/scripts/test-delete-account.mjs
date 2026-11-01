// Static contract tests for the retry-safe account deletion state machine.
// Not executed live (would destructively delete the calling account) — asserts
// the stage ordering, retry-safety, and PII-free audit logging from source.
import { readFileSync } from 'node:fs';

const source = readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');

const checks = [
  ['marks the account deletion_pending', source.includes('account_deletion_pending: true')],
  ['logs the authorize stage', source.includes("'account_deletion_authorized'")],
  ['logs the pending/revoke stage', source.includes("'account_deletion_pending'")],
  ['logs the cleanup-done stage', source.includes("'account_deletion_cleanup_done'")],
  ['logs the final deleted stage', source.includes("'account_deleted'")],
  ['logs the anonymized fallback stage', source.includes("'account_anonymized'")],
  ['anonymizes when User.delete refuses', /catch \(delErr\)[\s\S]*anonymiz/i.test(source)],
  ['audit logging records no PII', !source.includes('user.email') && !/detail:.*full_name/.test(source)],
  ['resume path skips re-authorizing a pending run', source.includes('const resuming = !!fresh.account_deletion_pending')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { console.error(`FAIL ${name}`); failed++; } else { console.log(`ok  ${name}`); }
}

// User.delete must occur AFTER the pending flag is set (delete LAST, not first).
const pendingIdx = source.indexOf('account_deletion_pending: true');
const firstUserDeleteIdx = source.indexOf('User.delete(user.id)');
if (pendingIdx === -1 || firstUserDeleteIdx === -1 || firstUserDeleteIdx < pendingIdx) {
  console.error('FAIL User.delete occurs before the pending flag (must be last)'); failed++;
} else { console.log('ok  User.delete occurs after the pending flag (last)'); }

// User.delete must occur AFTER cleanup completes (Stage 4, not Stage 1).
const cleanupDoneIdx = source.indexOf('account_deletion_cleanup_done');
if (firstUserDeleteIdx < cleanupDoneIdx) {
  console.error('FAIL User.delete appears before cleanup completes'); failed++;
} else { console.log('ok  User.delete appears after cleanup completes (Stage 4)'); }

if (failed) { console.error(`\n${failed} delete-account test(s) failed.`); process.exit(1); }
console.log('\nAll delete-account tests passed.');