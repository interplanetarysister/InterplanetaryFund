import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {loadComponent,cacheDir} from './helpers/render.js';
import {build} from 'esbuild';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {AGENT_FEATURES,agentWorkspaceHref,agentToolHref,parseAgentFeatureSelection,campaignFromOwnedList} from '../src/lib/agentFeatureRoutes.mjs';
const campaign='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222',owner='owner-A';
const render=(Component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,props)));

test('all ten roles resolve real workspace and feature links without private input',()=>{
 assert.equal(AGENT_FEATURES.length,10);
 for(const agent of AGENT_FEATURES){
  const href=agentWorkspaceHref(agent.identity,campaign),parsed=parseAgentFeatureSelection(href.slice(href.indexOf('?')));
  assert.equal(parsed.identity,agent.identity);assert.equal(parsed.campaignId,campaign);assert.equal(parsed.invalidCampaign,false);
  assert.match(agentToolHref(agent.identity,campaign),/^\/(?:agents|strategy|engagement|communications|connections|fundraising-partners|institutions|finances|dashboard)(?:\?|$)/);
 }
 assert.equal(agentToolHref('orbit',campaign),'/finances');assert.equal(agentToolHref('forge',campaign),'/engagement');
 assert.equal(agentToolHref('discover',campaign),'/fundraising-partners');
});
test('prototype identities, malformed campaign IDs and URL input cannot grant a feature or campaign',()=>{
 for(const identity of ['__proto__','constructor','toString','unknown'])assert.throws(()=>agentWorkspaceHref(identity,campaign),/available/);
 for(const value of ['https://evil.test/private','../owner','not-a-uuid',{},campaign+'?story=private'])assert.throws(()=>agentWorkspaceHref('story',value),/saved campaign/);
 assert.deepEqual(parseAgentFeatureSelection('?agent=__proto__&campaign=private'),{identity:null,campaignId:null,invalidCampaign:true});
 assert.equal(campaignFromOwnedList(campaign,[{id:foreign}],owner),'');
 assert.equal(campaignFromOwnedList(campaign,[{id:campaign,owner_id:'owner-B'}],owner),'');
 assert.equal(campaignFromOwnedList(campaign,[{id:campaign,owner_id:owner}],owner),campaign);
});
test('actual launcher exposes all ten accessible workspace and real-tool links',async()=>{
 const {default:Launcher}=await loadComponent('src/components/agents/AgentFeatureLauncher.jsx');
 const html=render(Launcher,{campaignId:campaign});
 for(const agent of AGENT_FEATURES){assert.ok(html.includes('Open '+agent.name));assert.ok(html.includes(agentWorkspaceHref(agent.identity,campaign).replaceAll('&','&amp;')));}
 assert.match(html,/href="\/fundraising-partners"/);assert.doesNotMatch(html,/undefined|javascript:/);
 const disabled=render(Launcher,{disabled:true});assert.doesNotMatch(disabled,/<a\b/);
});

const webRoot=fileURLToPath(new URL('../',import.meta.url));
let fixtureModule;
async function specialistModule(){
 if(fixtureModule)return fixtureModule;
 const outfile=path.join(cacheDir,'agent-feature-specialist-fixture.mjs');
 await build({entryPoints:[path.join(webRoot,'src/components/agents/SpecialistServiceWorkspace.jsx')],outfile,bundle:true,format:'esm',platform:'neutral',jsx:'automatic',alias:{'@':path.join(webRoot,'src')},external:['react','react/jsx-runtime','react-router-dom'],plugins:[{name:'verified-owner-workspace-fixture',setup(b){
  b.onResolve({filter:/hooks\/useSpecialistService$/},()=>({path:'service',namespace:'fixture'}));
  b.onResolve({filter:/hooks\/useAuthSession$/},()=>({path:'auth',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='service'?'export function useSpecialistService(){return globalThis.__agentFeatureFixture.service;}':'export function useAuthSession(){return {status:"ready",user:{id:globalThis.__agentFeatureFixture.owner}};}'}));
 }}],logLevel:'silent'});
 return fixtureModule=await import(pathToFileURL(outfile).href);
}
test('rendered ECHO scope selects the requested owned campaign and clears it for another owner',async()=>{
 const {default:Workspace}=await specialistModule();
 try{
  globalThis.__agentFeatureFixture={owner,service:{phase:'ready',locked:false,busy:false,workspace:{campaigns:[{id:campaign,owner_id:owner,title:'Owned campaign'}],messages:[]},reload(){}}};
  const own=render(Workspace,{identity:'echo',initialCampaignId:campaign});
  assert.match(own,new RegExp('option value="'+campaign+'" selected=""'));assert.match(own,/Owned campaign/);
  globalThis.__agentFeatureFixture={owner:'owner-B',service:{phase:'ready',locked:false,busy:false,workspace:{campaigns:[{id:foreign,owner_id:'owner-B',title:'Other current campaign'}],messages:[]},reload(){}}};
  const changed=render(Workspace,{identity:'echo',initialCampaignId:campaign});
  assert.doesNotMatch(changed,new RegExp('option value="'+campaign+'"'));assert.match(changed,/option value="" selected=""/);
 }finally{delete globalThis.__agentFeatureFixture;}
});
