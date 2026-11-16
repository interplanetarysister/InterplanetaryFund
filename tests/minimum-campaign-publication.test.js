import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {publishReadiness} from '../apps/web/src/lib/campaignLifecycle.js';
const sql=readFileSync(new URL('../supabase/migrations/20261116160726_ifund_minimum_campaign_publication.sql',import.meta.url),'utf8');
const form={title:'Help',story:'A need.',summary:'',category:'community',goal_amount:'1',cover_image_url:''};
test('title, short story and positive amount suffice; summary and editorial format are optional',()=>{
 assert.equal(publishReadiness(form).ready,true);
 for(const patch of [{title:''},{story:''},{story:' \n\t'},{goal_amount:''},{goal_amount:'0'},{goal_amount:'-1'}])assert.equal(publishReadiness({...form,...patch}).ready,false);
});
test('actual database permits minimal publication and retains owner and required-field denials',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated; create table public.ifund_campaigns(id serial primary key,owner_id text,title text,story text,summary text,status text,goal_amount numeric,constraint ifund_publish_complete check(status<>'active' or(length(title)>0 and length(summary)>0 and length(story)>0 and goal_amount>0)));alter table public.ifund_campaigns enable row level security;grant select,insert,update on public.ifund_campaigns to authenticated;grant usage on sequence ifund_campaigns_id_seq to authenticated;create policy owner on public.ifund_campaigns to authenticated using(owner_id=current_setting('test.owner')) with check(owner_id=current_setting('test.owner'));`);
 await db.exec(sql);await db.exec(sql);await db.exec(`create trigger publication_gate before insert or update on public.ifund_campaigns for each row execute function public.ifund_prepublication_story_gate();`);await db.exec(`set role authenticated;set test.owner='a';`);
 await db.query(`insert into public.ifund_campaigns(owner_id,title,story,summary,status,goal_amount) values('a','Help','A need.','','active',1)`);
 for(const [title,story,amount] of [['','Story',1],['Title','',1],['Title',' \n\t',1],['Title','Story',0],['Title','Story',null],['Title','Story','NaN'],['Title','Story','Infinity']])await assert.rejects(db.query(`insert into public.ifund_campaigns(owner_id,title,story,summary,status,goal_amount) values('a',$1,$2,'','active',$3)`,[title,story,amount]),error=>error.code==='23514'&&error.constraint==='ifund_publish_complete');
 await assert.rejects(db.query(`insert into public.ifund_campaigns(owner_id,title,story,status,goal_amount) values('b','Help','Story','active',1)`),/row-level security/);
 await db.exec(`set test.owner='b';`);assert.equal((await db.query(`update public.ifund_campaigns set story='Changed' returning id`)).rows.length,0);
 }finally{await db.close();}
});
