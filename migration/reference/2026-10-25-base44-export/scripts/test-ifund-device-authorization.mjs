import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile=(path)=>ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const sharedExports={};
new Function('exports',compile('base44/shared/deviceAuthorization.ts'))(sharedExports);
const authCode=compile('base44/functions/deviceAuthorization/entry.ts');
const rows=[], limits=[];
let currentUser=null;
let unhealthyAccount=false;
let unavailableLimiter=false;
const commands=[];
const entity={
  DeviceAuthorization:{
    filter:async(q)=>{
      const [key,value]=Object.entries(q)[0];
      return rows.filter(r=>r[key]===value).map(r=>({...r,scopes:[...r.scopes]}));
    },
    create:async(data)=>{
      const row={id:'authorization_'+(rows.length+1),...data};
      rows.push(row);
      return {...row};
    },
    get:async(id)=>rows.find(r=>r.id===id)||null,
    update:async(id,patch)=>{
      const row=rows.find(r=>r.id===id);if(!row)throw Error('missing auth');
      Object.assign(row,patch);return {...row};
    },
    updateMany:async(q,patch)=>{
      const matches=rows.filter(r=>r.id===q.id && r.state===q.state);
      for(const r of matches)Object.assign(r,patch.$set);
      return {count:matches.length};
    },
  },
  RateLimitBucket:{
    filter:async(q)=>{
      if(unavailableLimiter)throw Error('unavailable');
      return limits.filter(r=>r.key===q.key);
    },
    create:async(data)=>{const row={id:'limit_'+limits.length,...data};limits.push(row);return row;},
    update:async(id,data)=>{
      const row=limits.find(r=>r.id===id);Object.assign(row,data);
    },
    updateMany:async(q,patch)=>{
      const row=limits.find(r=>r.id===q.id);row.count+=patch.$inc.count;
    },
  },
  User:{
    get:async id=> id==='u1' ? {id:'u1',username:'pixie',full_name:'IFund Test User',
      account_status:unhealthyAccount?'disabled':'active'} : null,
  },
  Campaign:{
    filter:async q=>q.created_by_id==='u1'
      ? [{id:'own',title:'Own campaign',status:'active',goal_amount:100,raised_amount:12,secret_field:'MUST_NOT_LEAK'}] : [],
  },
};
const api={asServiceRole:{entities:entity},auth:{me:async()=>currentUser}};
const backendExports={};
new Function('require','exports','Response','console',authCode)(
  name=>{
    if(name.includes('base44/sdk'))return {createClientFromRequest:()=>api};
    if(name.endsWith('accountGuard.ts'))return {assertActiveAccount:async()=>
      currentUser?{ok:true,user:currentUser}:{ok:false,status:401,error:'Sign in'}};
    if(name.endsWith('deviceAuthorization.ts'))return sharedExports;
    throw Error('Unmocked import '+name);
  },backendExports,Response,{error:()=>{}},
);
const handler=backendExports.default;
const call=async(payload,headers={})=>{
  const req=new Request('https://interplanetaryfund.com/device-api',{
    method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload),
  });
  commands.push(payload.mode);
  const res=await handler(req);
  return {status:res.status,json:await res.json()};
};
const scope=['identity:read','campaigns:read'];

currentUser=null;
const invalid=await call({mode:'start',client_id:'unknown-app',device_label:'Hacker',scopes:scope});
assert.equal(invalid.status,400);
const excessive=await call({mode:'start',client_id:'ifund-cli-v1',device_label:'Unlimited',scopes:['payments:withdraw']});
assert.equal(excessive.status,400);
unavailableLimiter=true;
assert.equal((await call({mode:'start',client_id:'ifund-cli-v1',device_label:'Untrusted',scopes:scope})).status,503);
unavailableLimiter=false;
const start=await call({mode:'start',client_id:'ifund-cli-v1',device_label:'Work laptop',scopes:scope});
assert.equal(start.status,200);
const {device_code,user_code,verification_uri,interval}=start.json;
assert.equal(verification_uri,'https://interplanetaryfund.com/activate');
assert.equal(interval,5);
assert.match(device_code,/^[a-f0-9]{64}$/);
assert.match(user_code,/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
const raw=JSON.stringify(rows);
assert.ok(!raw.includes(device_code));
assert.ok(!raw.includes(user_code));

const bearer=await sharedExports.accessTokenFor(device_code);
const forbidden=await call({mode:'resource',action:'identity'},{'x-ifund-device-token':bearer});
assert.equal(forbidden.status,401,'Token cannot access owner before approval');
const pending=await call({
  mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code,
});
assert.equal(pending.json.error,'authorization_pending');
const slow=await call({
  mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code,
});
assert.equal(slow.json.error,'slow_down');

currentUser={id:'u1',role:'user',username:'pixie'};
assert.equal((await call({mode:'inspect',user_code:'ABCDH-23456'})).status,404);
const info=await call({mode:'inspect',user_code:user_code.toLowerCase()});
assert.equal(info.status,200);
assert.deepEqual(info.json.scopes,scope);
assert.equal(info.json.device_label,'Work laptop');

const approve=await call({mode:'decide',user_code,decision:'approve'});
assert.equal(approve.status,200);
assert.equal(approve.json.decision,'approve');
assert.equal((await call({mode:'decide',user_code,decision:'approve'})).status,409,'Used codes cannot reauthorize');
currentUser=null;
const token=await call({
  mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code,
});
assert.equal(token.status,200);
assert.equal(token.json.token_type,'Bearer');
assert.equal(token.json.access_token,bearer);
assert.equal(token.json.scope,scope.join(' '));
assert.ok(token.json.expires_in>0);
assert.ok(!JSON.stringify(rows).includes(token.json.access_token));

const identity=await call({mode:'resource',action:'identity'},{'x-ifund-device-token':bearer});
assert.equal(identity.status,200);
assert.equal(identity.json.identity.username,'pixie');
assert.ok(!('email' in identity.json.identity));
const campaigns=await call({mode:'resource',action:'campaigns'},{'x-ifund-device-token':bearer});
assert.equal(campaigns.status,200);
assert.equal(campaigns.json.campaigns[0].id,'own');
assert.ok(!('secret_field' in campaigns.json.campaigns[0]));
assert.equal((await call({mode:'resource',action:'withdraw'},{'x-ifund-device-token':bearer})).status,403);
assert.equal((await call({mode:'resource',action:'identity'},{'x-ifund-device-token':'ifd_at_'+'a'.repeat(64)})).status,401);

currentUser={id:'u1',username:'pixie'};
const listing=await call({mode:'list'});
assert.equal(listing.status,200);
assert.equal(listing.json.devices.length,1);
assert.equal(listing.json.devices[0].device_label,'Work laptop');
assert.ok(!JSON.stringify(listing.json).includes('token_hash'));
const revocation=await call({mode:'revoke',authorization_id:rows[0].id});
assert.equal(revocation.status,200);
currentUser=null;
assert.equal((await call({mode:'resource',action:'identity'},{'x-ifund-device-token':bearer})).status,401);
assert.equal((await call({mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code})).json.error,'access_denied');

const start2=await call({mode:'start',client_id:'ifund-device-v1',device_label:'Tablet',scopes:['identity:read']});
assert.equal(start2.status,200);
currentUser={id:'u1'};
assert.equal((await call({mode:'decide',user_code:start2.json.user_code,decision:'deny'})).status,200);
currentUser=null;
assert.equal((await call({mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:start2.json.device_code})).json.error,'access_denied');

const start3=await call({mode:'start',client_id:'ifund-agent-v1',device_label:'Auditor',scopes:['identity:read']});
currentUser={id:'u1'};
assert.equal((await call({mode:'decide',user_code:start3.json.user_code,decision:'approve'})).status,200);
currentUser=null;
const bearer3=await sharedExports.accessTokenFor(start3.json.device_code);
assert.equal((await call({mode:'resource',action:'campaigns'},{'x-ifund-device-token':bearer3})).status,403);
unhealthyAccount=true;
assert.equal((await call({mode:'resource',action:'identity'},{'x-ifund-device-token':bearer3})).status,403);
unhealthyAccount=false;
assert.ok(commands.filter(x=>x==='start').length>=3);
const fresh = await call({mode:'start',client_id:'ifund-cli-v1',device_label:'Expiring device',scopes:['identity:read']});
assert.equal(fresh.status,200);
const last = rows.at(-1);
last.expires_at = new Date(Date.now()-1000).toISOString();
currentUser={id:'u1'};
assert.equal((await call({mode:'inspect',user_code:fresh.json.user_code})).status,404);
currentUser=null;
assert.equal((await call({mode:'poll',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:fresh.json.device_code})).json.error,'expired_token');

const ui = fs.readFileSync(new URL('../src/pages/DeviceActivation.jsx',import.meta.url),'utf8');
const manager = fs.readFileSync(new URL('../src/pages/ConnectedDevices.jsx',import.meta.url),'utf8');
const routes = fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const profile = fs.readFileSync(new URL('../src/pages/Profile.jsx',import.meta.url),'utf8');
assert.ok(routes.includes('path="/activate"'));
assert.ok(routes.includes('path="/devices"'));
assert.match(ui,/mode:"inspect"/);
assert.match(ui,/mode:"decide"/);
assert.match(manager,/mode:"revoke"/);
assert.match(profile,/Manage devices and approvals/);

console.log('PASS: device code start, human approval/deny, scoped token exchange, read-only resources, revocation, account guard and fail-closed limits.');
