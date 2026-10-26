import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import { resolveGeneratedImageUrl, loadGeneratedImage } from '../src/lib/generatedMedia.js';

const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
function handler(path,base44) {
 const js=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const require=(name)=>{
  if(name.startsWith('npm:@base44/sdk'))return{createClientFromRequest:()=>base44};
  // saveCampaign now sanitizes responses through this separate audited helper.
  // Keep this handler-focused mock narrow; response allowlisting has its own tests.
  if(name==='../../shared/campaignResponse.ts')return{campaignForResponse:(row)=>row};
  if(name==='../../shared/serverImagePolicy.ts')return{enforceImagePolicy:async(_client,_user,url)=>url,validIfundMediaUrl:(url)=>url.startsWith('https://media.base44.com/')?url:''};
  if(name==='../../shared/accountGuard.ts')return{assertActiveAccount:async(client)=>{
    const user=await client.auth.me();
    return user?{ok:true,user}:{ok:false,status:401,error:'Authentication required'};
  }};
  throw Error('Unknown dependency '+name);
 };
 new Function('require','exports','Response','console',js)(require,exports,Response,console);
 return exports.default;
}
function fixture({missingUser=false, foreignOwner=false}={}) {
 const calls=[];
 const draft={id:'draft123',created_by_id:foreignOwner?'other':'user',status:'draft'};
 const mock={auth:{me:async()=>missingUser?null:{id:'user',role:'user'}},
  entities:{Campaign:{create:async row=>{calls.push({op:'create',row});return{id:'created123',...row};}}},
  asServiceRole:{entities:{Campaign:{
    create:async row=>{calls.push({op:'create',row});return{id:'created123',...row};},
    filter:async()=>[draft],
    update:async(id,row)=>{calls.push({op:'update',id,row});return{id,...row};}
  }}}};
 return{mock,calls};
}
const request=body=>({json:async()=>body});
{
 const x=fixture(),fn=handler('base44/functions/saveCampaign/entry.ts',x.mock);
 const r=await fn(request({campaign:{title:'',goal_amount:0,status:'draft',draft_step:0,
  ai_profile:{primary_goal:'Reach neighbors'},story_versions:[]}}));
 assert.equal(r.status,200);
 assert.equal(x.calls[0].row.title,'');
 assert.equal(x.calls[0].row.goal_amount,0);
 assert.equal(x.calls[0].row.ai_profile.primary_goal,'Reach neighbors');
}
{
 const x=fixture(),fn=handler('base44/functions/saveCampaign/entry.ts',x.mock);
 const res=await fn(request({campaign_id:'draft123',campaign:{
  title:'Partial',goal_amount:'',status:'draft',draft_step:2,story:'Half-finished',
  story_versions:[{text:'Earlier version',style:'clearer'}]}}));
 assert.equal(res.status,200);
 assert.equal(x.calls[0].op,'update');
 assert.equal(x.calls[0].row.goal_amount,0);
 assert.equal(x.calls[0].row.draft_step,2);
 assert.equal(x.calls[0].row.story_versions[0].text,'Earlier version');
}
{
 const x=fixture(),fn=handler('base44/functions/saveCampaign/entry.ts',x.mock);
 const r=await fn(request({campaign:{title:'',goal_amount:0,status:'active'}}));
 assert.equal(r.status,400);
 assert.equal(x.calls.length,0);
}
{
 const x=fixture({foreignOwner:true}),fn=handler('base44/functions/saveCampaign/entry.ts',x.mock);
 const r=await fn(request({campaign_id:'draft123',campaign:{title:'Mine?',goal_amount:1,status:'draft'}}));
 assert.equal(r.status,403);assert.equal(x.calls.length,0);
}
{
 const x=fixture({missingUser:true}),fn=handler('base44/functions/saveCampaign/entry.ts',x.mock);
 const r=await fn(request({campaign:{title:'No session',goal_amount:0,status:'draft'}}));
 assert.equal(r.status,401);
}
const entity=JSON.parse(read('base44/entities/Campaign.jsonc'));
assert.deepEqual(entity.required,[]);
assert.equal(entity.properties.goal_amount.minimum,0);
assert.ok(entity.properties.draft_step);
assert.match(read('src/pages/CreateCampaign.jsx'),/onClick=\{saveDraft\}/);
assert.match(read('src/pages/CreateCampaign.jsx'),/setStep\(Math.min\(3, Math.max\(0, Number\(draft.draft_step\)/);
assert.match(read('src/components/campaigns/CampaignCard.jsx'),/isDraft \? `\/create\?draft=/);
assert.match(read('base44/functions/enforceCampaignProtocol/entry.ts'),/if \(c.status === 'draft'\)/);

assert.equal(resolveGeneratedImageUrl({url:'https://media.base44.com/media/image.png'}),'https://media.base44.com/media/image.png');
assert.equal(resolveGeneratedImageUrl({data:{images:[{url:'https://example.com/a.webp'}]}}),'https://example.com/a.webp');
assert.equal(resolveGeneratedImageUrl({url:'javascript:alert(1)'}),'');
assert.equal(resolveGeneratedImageUrl({url:'http://example.com/a.png'}),'');
assert.equal(resolveGeneratedImageUrl({error:'generation failed'}),'');
const originalWindow=globalThis.window;
globalThis.window={ Image:class {
 set src(src){ this.naturalWidth=1200; this.naturalHeight=900; queueMicrotask(()=>this.onload?.()); }
 decode(){return Promise.resolve();}
}};
assert.equal(await loadGeneratedImage('https://example.com/pass.png',200),'https://example.com/pass.png');
globalThis.window={ Image:class {
 set src(src){queueMicrotask(()=>this.onerror?.());}
}};
await assert.rejects(()=>loadGeneratedImage('https://example.com/fail.png',200),/failed to load/);
globalThis.window=originalWindow;
const image = read('src/components/ui/image.jsx');
assert.match(image,/main image MUST participate in layout/i);
assert.match(image,/"block w-full h-auto"/);
assert.match(image,/setUseOriginal\(true\)/);
assert.match(read('src/pages/CreateCampaign.jsx'),/brandAndUploadGeneratedImage\(base44, url\)/);
assert.match(read('src/components/media/MediaUpload.jsx'),/uploadUserImage\(base44, file\)/);
assert.match(read('base44/functions/generateSocialContent/entry.ts'),/if \(typeof mediaUrl !== 'string'/);
console.log('PASS: 5 draft handler cases; schema, resume, generated media URL/load/error, intrinsic image sizing and raw fallback.');
