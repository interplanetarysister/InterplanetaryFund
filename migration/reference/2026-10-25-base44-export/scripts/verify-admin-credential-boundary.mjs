import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const account = read('base44/entities/PlatformOwnedAccount.jsonc');
const messages = read('base44/entities/AdminActionMessage.jsonc');
const queue = read('src/components/admin/AdminApprovalQueue.jsx');
const refs = read('base44/entities/AdminCredentialReference.jsonc');
const refsSchema = JSON.parse(refs);
const bb = read('base44/shared/browserbaseSecrets.ts');

assert.match(account, /"credential_reference"/);
assert.match(account, /Reference to secure credential storage only/);

assert.doesNotMatch(messages, /credential_secret|credential_username|password|sign_in_secret/i);
assert.doesNotMatch(queue, /credential_secret|credential_username/);
assert.match(queue, /provider-hosted sign-in|protected Connections flow/i);

assert.match(refs, /"browserbase_secret_id"/);
assert.match(refs, /"browserbase_secret_key"/);
assert.doesNotMatch(refs, /"secret_value"|"password"|"sign_in_secret"/i);
assert.doesNotMatch(refs, /__service_only__|service_only/i,
  'Base44 entity RLS must use supported roles, not an invented service-only sentinel');
for (const operation of ['read', 'create', 'update', 'delete']) {
  assert.deepEqual(refsSchema.rls?.[operation], { user_condition: { role: 'admin' } },
    `AdminCredentialReference ${operation} must be restricted to Base44 admins`);
}

assert.match(bb, /\/v1\/secrets\/keypair/);
assert.match(bb, /sealedSecretValue/);
assert.match(bb, /DhkemX25519HkdfSha256/);
assert.match(bb, /Aes256Gcm/);
assert.match(bb, /deleteBrowserbaseSecret/);

const legacyVault = read('base44/entities/AdminCredentialVault.jsonc');
const legacyVaultSchema = JSON.parse(legacyVault);
assert.match(legacyVault, /Deprecated reference-only compatibility entity/);
assert.doesNotMatch(legacyVault, /"secret_value"|"password"|"username"|"sign_in_secret"/i,
  'deprecated credential-vault compatibility schema must remain reference-only');
assert.match(legacyVault, /"browserbase_secret_id"/);
assert.match(legacyVault, /"browserbase_secret_key"/);
assert.doesNotMatch(legacyVault, /__service_only__|service_only/i,
  'compatibility entity RLS must use supported Base44 roles');
for (const operation of ['read', 'create', 'update', 'delete']) {
  assert.deepEqual(legacyVaultSchema.rls?.[operation], { user_condition: { role: 'admin' } },
    `AdminCredentialVault ${operation} must be restricted to Base44 admins`);
}
assert.equal(fs.existsSync('base44/functions/storeAdminPlatformCredential/entry.ts'), false,
  'IFund must not accept reusable raw platform passwords until the provider-managed secret/function boundary is active');

console.log('Admin credential boundary verified: reference-only Base44 metadata, provider-managed encrypted secrets, no ordinary raw credential storage.');