import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const get = read('base44/functions/getAppUserConnector/entry.ts');
const registry = read('base44/shared/connectionVerification.ts');
const verify = read('base44/functions/verifyAppUserConnector/entry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const disconnect = read('base44/functions/disconnectPlatformConnection/entry.ts');
const dialog = read('src/components/connections/ConnectDialog.jsx');
const card = read('src/components/connections/ConnectionCard.jsx');
const runtime = read('scripts/require-node22.mjs');
const appUserProviders = ['linkedin','facebook','instagram','discord','tiktok','eventbrite','gumroad'];
for (const provider of appUserProviders) {
  assert.match(registry, new RegExp('\\b'+provider+':'), provider+' missing canonical app-user connector registry entry');
  assert.match(finalize, new RegExp('\\b'+provider+':'), provider+' missing OAuth finalization config');
}
for (const unsupported of ['threads','pinterest','reddit','youtube','patreon']) {
  assert.doesNotMatch(registry, new RegExp('\\b'+unsupported+':'), unsupported+' must not be advertised as an app-user OAuth connector without Base44 connector support');
}
assert.doesNotMatch(registry, /\bx:/, 'X is shared-only in the current Base44 connector catalog and must not be exposed as an app-user OAuth connector');
for (const consumer of [get, verify, disconnect]) {
  assert.match(consumer, /OAUTH_ENV/, 'connector lifecycle function must consume canonical OAuth registry');
}
assert.match(dialog, /connectAppUser/);
assert.match(dialog, /ifund_pending_platform_connection/);
assert.match(finalize, /providerCapabilities/);
assert.match(finalize, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.doesNotMatch(finalize, /granted_capabilities:\s*cfg\.requestedCapabilities/);
assert.match(card, /disconnectPlatformConnection/);
assert.doesNotMatch(card, /PlatformConnection\.delete/);
assert.match(runtime, /const MINIMUM_NODE_MAJOR = 24;/);
assert.doesNotMatch(runtime, /TESTED_NODE_MAJORS/);
assert.match(runtime, /!supportedRuntime/);
console.log('Procon connection contract passed against current Base44 app-user connector support.');
