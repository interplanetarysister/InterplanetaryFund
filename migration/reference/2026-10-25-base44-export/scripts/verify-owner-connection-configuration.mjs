import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');
const fn = read('base44/functions/manageOwnerConnectionConfiguration/entry.ts');
const context = read('base44/functions/getVerifiedIFundIntegrationContext/entry.ts');
const schema = JSON.parse(read('base44/entities/IntegrationChangeRequest.jsonc'));
for(const marker of [
  'assertActiveAccount', 'OWNER_EMAILS.has(clean(user.email))',
  "mode === 'prepare'", "mode === 'status'", "mode === 'execute'",
  'pending.owner_user_id !== user.id',
  'IntegrationChangeRequest.updateMany({',
  "status:'pending', expires_at:pending.expires_at",
  "status:'applying',approved_at:claimedAt",
  "Number(claimed?.updated) !== 1",
  "PlatformConnectionRecipe.updateMany({",
  "Number(applied?.updated) !== 1",
  "This request was already claimed. Check its status.",
  "Exactly one configured provider recipe is required",
  'orderedTransports(existing || recipe)',
]) assert.ok(fn.includes(marker), 'Missing owner authorization or safety guard: '+marker);
assert.ok(!fn.includes('PlatformConnectionRecipe.create('),'Unverified concurrent recipe creation must remain disabled');
assert.ok(!fn.includes('PlatformConnectionRecipe.update('),'Direct unconditional mutation must remain disabled');
assert.ok(schema.properties.status.enum.includes('applying'),'Schema must permit claimed approval state');
assert.ok(!fn.includes('Deno.env.get('),'Do not read raw credentials');
assert.ok(!fn.includes('fetch('),'No arbitrary external requests');
assert.ok(schema.properties.status.enum.includes('pending'));
assert.ok(context.includes('config_mutation_authorized: false'));
assert.ok(context.includes('registration_verified: false'));
assert.ok(context.includes("PlatformConnectionRecipe.filter({ platform, operation: 'connect' })"));
assert.ok(context.includes("const disabled = selected?.status === 'disabled'"));
assert.ok(context.includes('persisted_recipe_available: !!selected'));
console.log('IFund owner connection authority fail-closed contract passed');
