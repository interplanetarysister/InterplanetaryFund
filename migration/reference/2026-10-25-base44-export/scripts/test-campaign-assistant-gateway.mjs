import assert from 'node:assert/strict';
import { campaignAssistant } from '../host/gateway/campaign-assistant.js';
const nativeFetch = globalThis.fetch;
const origin = 'https://interplanetaryfund.com';
let inference = 0;
let prompt = '';
let mode = 'ok';
const env = {
 IFUND_ALLOWED_ORIGINS: origin, IFUND_CAMPAIGN_AI_ENABLED: 'enabled',
 CAMPAIGN_AI_LIMITER: { limit: async()=>({success:mode !== 'limited'}) },
 AI: { run: async(model,input)=>{
   inference++;prompt=input.prompt || input.messages[1].content;
   if(mode==='bad') return {response:'not JSON'};
   if(model.includes('flux')) return {image:'YWJj'};
   return {choices:[{message:{content:JSON.stringify({options:['One','Two','Three','Four','Five']})}}]};
 }},
};
function req(body, auth=true, requestOrigin=origin) {
 return new Request('https://example.test/api/v1/campaign-assistant',{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',...(auth?{authorization:'Bearer '+ 'x'.repeat(30)}:{})},body:JSON.stringify(body)});
}
try {
 globalThis.fetch=async(url,init)=>{
   assert.match(String(url),/^https:\/\/base44\.app\/api\/apps\/6a67a778342a8fe05ee79cba\//);
   assert.equal(init.redirect,'error');
   return Response.json(String(url).endsWith('/me') ? {id:'user-1',account_status:'active'} : {available:{ai_campaign_assistant:mode!=='disabled'}});
 };
 assert.equal((await campaignAssistant(req({kind:'text'}),{...env,IFUND_CAMPAIGN_AI_ENABLED:'disabled'})).status,503);
 assert.equal((await campaignAssistant(req({kind:'text'},false),env)).status,401);
 assert.equal((await campaignAssistant(req({kind:'text'},true,'https://evil.test'),env)).status,403);
 assert.equal(inference,0);
 const text={kind:'text',output:'options',prompt:'Five titles for a community kitchen.'};
 assert.equal((await campaignAssistant(req(text),env)).status,200);
 mode='limited';const before=inference;assert.equal((await campaignAssistant(req(text),env)).status,429);assert.equal(inference,before);
 mode='disabled';assert.equal((await campaignAssistant(req(text),env)).status,403);assert.equal(inference,before);
 mode='bad';assert.equal((await campaignAssistant(req(text),env)).status,502);
 mode='ok';
 const result=await campaignAssistant(req({kind:'image',campaign:{title:'Kitchen',category:'community',summary:'Feed neighbors',story:'Restore a kitchen.',goal_amount:750,ai_profile:{who_helping:'Local families'}}}),env);
 assert.equal(result.status,200);assert.match((await result.json()).url,/^data:image\/jpeg;base64,/);
 for(const detail of ['Restore a kitchen.','Feed neighbors','Local families','$750','futuristic-mystical-nature','Representative people']) assert.ok(prompt.includes(detail),detail);
 assert.equal((await campaignAssistant(req({kind:'image',campaign:{title:'No purpose'}}),env)).status,400);
 assert.equal((await campaignAssistant(req({kind:'text',output:'options',prompt:'x'.repeat(33000)}),env)).status,413);
 console.log('PASS: disabled/auth/origin/feature/rate gates, structured text, malformed output, full image context, representative people, and request size; mocked inference only.');
} finally {globalThis.fetch=nativeFetch;}
