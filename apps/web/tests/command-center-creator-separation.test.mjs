import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const creator=readFileSync(new URL('../src/pages/CreateCampaign.jsx',import.meta.url),'utf8');
const strategy=readFileSync(new URL('../src/pages/CampaignStrategy.jsx',import.meta.url),'utf8');

test('third creator step remains a simple review and launch, not a mandatory editorial score',()=>{
  assert.match(creator,/step===2&&<section aria-label="Campaign launch review"/);
  assert.match(creator,/step===2&&ownerId&&<p[^>]*>Want to improve your campaign further/);
  assert.doesNotMatch(creator,/<PrepublicationGate\b/);
  assert.doesNotMatch(creator,/<CampaignReadinessScore\b/);
  assert.match(creator,/publishReadiness\(form\)/);
  assert.match(creator,/validateCampaignForm\(form, \{ publish: status === "active" \}\)/);
});
test('optional Command Center is owner scoped and does not imply a required story length',()=>{
  assert.match(strategy,/ifund_owner_campaign_strategy_readiness/);
  assert.match(strategy,/private campaign readiness could not be verified/);
  assert.doesNotMatch(strategy,/characters before publishing|3,500 characters before publishing/i);
  assert.match(creator,/to="\/analytics"/);
});
test('creator offers a private draft and preserves guest-versus-owner publishing boundary',()=>{
  assert.match(creator,/Guest drafts stay in this browser/);
  assert.match(creator,/Publishing requires a secure account with a verified owner ID/);
  assert.match(creator,/save\("active"\)/);
  assert.match(creator,/Save or publish campaign/);
});
