import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Real handlers run with mock Base44 entities; zero live records/payments.
function load(name, mock, enabled) {
  const raw = readFileSync(new URL('../base44/functions/'+name+'/entry.ts',import.meta.url),'utf8');
  const src = raw.replace(/^import .*?;\s*$/gm,'').replace('export default async function','return async function');
  return new Function('createClientFromRequest','isFeatureEnabled','featureUnavailable','assertActiveAccount',src)(
    ()=>mock,
    async()=>enabled,
    label=>Response.json({error:label},{status:409}),
    async client=>({ok:true,user:await client.auth.me()}),
  );
}
function fixture(failMembership=false) {
 const calls={created:[],deleted:[],members:0};
 const mock={auth:{me:async()=>({id:'owner',role:'user'})},entities:{
  Community:{create:async data=>{calls.created.push(data);return{id:'community1',...data};},delete:async id=>calls.deleted.push(id)},
  CommunityMember:{create:async()=>{if(failMembership)throw Error('membership failed');calls.members++;}},
  Institution:{create:async data=>{calls.created.push(data);return{id:'institution1',...data};}},
 }};
 return{mock,calls};
}
const request=data=>({json:async()=>data});
{
 const x=fixture(),res=await load('createCommunity',x.mock,true)(request({name:'Helper Community',type:'interest'}));
 assert.equal(res.status,200);assert.equal((await res.json()).community.id,'community1');
 assert.equal(x.calls.members,1);
}
{
 const x=fixture(),res=await load('createCommunity',x.mock,false)(request({name:'Blocked',type:'interest'}));
 assert.equal(res.status,409);assert.equal(x.calls.created.length,0);
}
{
 const x=fixture(true),old=console.error;console.error=()=>{};
 const res=await load('createCommunity',x.mock,true)(request({name:'Rollback',type:'interest'}));
 console.error=old;
 assert.equal(res.status,500);assert.deepEqual(x.calls.deleted,['community1']);
}
{
 const x=fixture(),res=await load('createInstitution',x.mock,true)(request({name:'Foundation',type:'nonprofit',offers_grants:true}));
 assert.equal(res.status,200);assert.equal(x.calls.created[0].verification_status,'unverified');
}
{
 const x=fixture(),res=await load('createInstitution',x.mock,false)(request({name:'Blocked',type:'nonprofit'}));
 assert.equal(res.status,409);assert.equal(x.calls.created.length,0);
}
console.log('PASS: 5 mocked live-handler scenarios for gated community and institution creation.');
