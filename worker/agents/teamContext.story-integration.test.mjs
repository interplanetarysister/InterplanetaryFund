import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const story=readFileSync(new URL('./story.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('./teamContext.js',import.meta.url),'utf8');
test('STORY shares owner-scoped read adapter, not a second raw RPC path',()=>{
 assert.match(story,/import\s*\{[^}]*readTeamContext[^}]*\}\s*from\s*['\"]\.\/teamContext\.js['\"]/);
 assert.match(story,/const team = await readTeamContext\(\{[\s\S]*?env, jwt, campaignId: input\.campaign_id, limit: 12, fetcher/);
 assert.doesNotMatch(story,/rpc\(['\"]ifund_team_recent['\"]/);
 assert.match(story,/team\.events\.filter\(row => row\.event_key !== request_id\)/);
});
test('context is feature-gated and missing backend data fails closed',()=>{
 assert.match(story,/if \(env\.IFUND_TEAM_CONTEXT_ENABLED === ['\"]enabled['\"]\)/);
 assert.match(story,/if \(team\.state !== ['\"]ready['\"]\)/);
 assert.match(adapter,/Authorization: ['\"]Bearer ['\"]\+jwt/);
 assert.doesNotMatch(adapter,/p_owner_id\s*:/);
});

test('completion and replay persist one canonical draft payload and never truncate structured JSON',()=>{
 assert.match(story,/content: JSON\.stringify\(claim\.draft\.payload\)/);
 assert.match(story,/content: JSON\.stringify\(draft\?\.payload \?\? suggestion\)/);
 assert.doesNotMatch(story,/JSON\.stringify\(claim\.draft\.payload\)\.slice\(/);
});
