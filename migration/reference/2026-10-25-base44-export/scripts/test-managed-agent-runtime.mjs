import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const file = fs.readFileSync('base44/shared/managedQueue.ts', 'utf8')
  .replace(/^import .*;\s*$/gm, '');
const stubs = `
const hasManagedConnections = (owner) => owner.entitled === true;
const hasUnifiedOboConsent = (owner) => owner.ai_obo_consent?.granted === true;
`;
const source = ts.transpileModule(stubs + file, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { completeVerifiedManagedWork } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);

const owner = {
  id: 'owner-1', entitled: true, ai_obo_consent: {
    granted: true, permission_version: 'v-1',
  },
};
const connection = {
  id: 'connection-1', created_by_id: owner.id,
  platform: 'bluesky', status: 'connected', verification_status: 'verified',
  obo_consent: { granted: true, permission_version: 'v-1', opted_out: false },
  agent_access: { shared_with_agents: true },
};
const work = {
  id: 'work-1', owner_user_id: owner.id,
  destination_agent: 'managed_connection_agent',
  status: 'waiting_external', objective: 'repair bluesky',
  consent_version: 'v-1',
  continuation_state: { continuation_ref: 'connection-1', completed_steps: [] },
};
function mock(data = { owner, work }) {
  const updates = [];
  const sr = {
    entities: {
      User: { get: async () => data.owner },
      AgentDelegation: {
        filter: async () => [data.work],
        update: async (id, patch) => { updates.push({ id, patch }); return patch; },
      },
    },
  };
  return { sr, updates };
}

const first = mock();
assert.equal(await completeVerifiedManagedWork(first.sr, connection, new Date().toISOString()), 1);
assert.equal(first.updates[0].patch.status, 'completed');
assert.match(first.updates[0].patch.verification, /^syncConnections:provider_check:/);

for (const restricted of [
  { name: 'owner revocation', owner: { ...owner, ai_obo_consent: { granted: false, permission_version: 'v-1' } } },
  { name: 'expired entitlement', owner: { ...owner, entitled: false } },
  { name: 'connection revocation', connection: { ...connection, obo_consent: { ...connection.obo_consent, opted_out: true } } },
  { name: 'consent version mismatch', work: { ...work, consent_version: 'older' } },
  { name: 'different connection', work: { ...work, continuation_state: { continuation_ref: 'another-id' } } },
  { name: 'account creation not verified', work: { ...work, objective: 'create_account bluesky' } },
  { name: 'provider not verified', connection: { ...connection, verification_status: 'unverified' } },
]) {
  const testing = mock({ owner: restricted.owner || owner, work: restricted.work || work });
  assert.equal(
    await completeVerifiedManagedWork(testing.sr, restricted.connection || connection, new Date().toISOString()),
    0,
    restricted.name,
  );
  assert.equal(testing.updates.length, 0, restricted.name);
}

const allowed = fs.readFileSync('base44/functions/authorizeConnectionAi/entry.ts', 'utf8');
assert.match(allowed, /body\.granted !== true/);
assert.match(allowed, /ownerVisible\.created_by_id !== user\.id/);
assert.match(allowed, /opted_out: false/);
const revoked = fs.readFileSync('base44/functions/revokeConnectionAiConsent/entry.ts', 'utf8');
assert.match(revoked, /opted_out: true/);
const access = fs.readFileSync('base44/shared/integrationRegistry.ts', 'utf8');
assert.match(access, /connection\.obo_consent\?\.opted_out === true/);
assert.match(access, /connection\.agent_access\?\.shared_with_agents !== true/);
const scheduled = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
assert.doesNotMatch(scheduled, /getCurrentAppUserConnection\(/);
assert.match(scheduled, /completeVerifiedManagedWork\(/);
assert.match(scheduled, /probes >= 12/);
console.log('Managed AI runtime owner/consent/provider gates passed.');
