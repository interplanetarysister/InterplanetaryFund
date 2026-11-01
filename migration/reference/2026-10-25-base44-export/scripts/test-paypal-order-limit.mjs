// Static contract tests for the PayPal order-creation rate limit.
// No live PayPal order (would create a real order) — asserts the narrow
// session-creation limit is present and successful captures are not limited.
import { readFileSync } from 'node:fs';

const create = readFileSync('base44/functions/createPayPalOrder/entry.ts', 'utf8');
const capture = readFileSync('base44/functions/capturePayPalOrder/entry.ts', 'utf8');

const createChecks = [
  ['createPayPalOrder imports the rate limiter', create.includes("from '../../shared/rateLimit.ts'")],
  ['createPayPalOrder rate-limits order creation', /checkRateLimit\(\s*base44,\s*`createPayPalOrder:/.test(create)],
  ['createPayPalOrder limit is 10 per 60s', /createPayPalOrder:\$\{ip\}`,\s*10,\s*60/.test(create)],
  ['createPayPalOrder returns 429 when limited', create.includes('{ status: 429 }')],
];

let failed = 0;
for (const [name, ok] of createChecks) {
  if (!ok) { console.error(`FAIL ${name}`); failed++; } else { console.log(`ok  ${name}`); }
}

// capturePayPalOrder must only ever rate-limit FAILED capture attempts
// (captureFail key). The success path (after a completed capture) must not call
// the limiter at all.
const rlCalls = [...capture.matchAll(/checkRateLimit\(\s*base44,\s*`([^`]+)`/g)].map((m) => m[1]);
const allFailGuards = rlCalls.length > 0 && rlCalls.every((k) => k.startsWith('captureFail:'));
if (!allFailGuards) { console.error('FAIL capturePayPalOrder rate-limits a non-failure path'); failed++; }
else { console.log(`ok  capturePayPalOrder only rate-limits failures (${rlCalls.length} guard(s))`); }

if (failed) { console.error(`\n${failed} paypal-order-limit test(s) failed.`); process.exit(1); }
console.log('\nAll paypal-order-limit tests passed.');