import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../../supabase/migrations/20261115094500_ifund_shared_agent_team_events.sql',import.meta.url),'utf8');
const correct=sql.split('create or replace function public.ifund_team_correct(')[1]?.split('end $team_correct$;')[0];
test('owner correction locks the original event before inspecting replay',()=>{
 assert.ok(correct);
 assert.match(correct,/owner_id=actor and event_key=p_old_event_key[\s\S]*?for update;/i);
});
test('same owner and exact new event identity/content required for idempotent replay',()=>{
 assert.match(correct,/old_event\.corrected_by is not null/);
 for(const part of ['e.id=old_event.corrected_by','e.owner_id=actor','e.event_key=p_new_event_key',"e.speaker='user'",'e.content=btrim(p_content)','e.deleted_at is null']) assert.ok(correct.includes(part),part);
 assert.match(correct,/if new_id is not null then return new_id;/);
});
test('erased, altered or conflicting corrections fail closed',()=>{
 assert.match(correct,/Statement already corrected or erased/);
 assert.match(correct,/errcode='23505'/);
 assert.match(correct,/old_event\.deleted_at is not null/);
});
