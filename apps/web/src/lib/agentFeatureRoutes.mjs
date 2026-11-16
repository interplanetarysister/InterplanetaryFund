import { AGENT_WORKSPACES } from './agentWorkspaces.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES=Object.freeze(Object.fromEntries(AGENT_WORKSPACES.map(role=>[role.identity,role])));
export const AGENT_FEATURES=Object.freeze(AGENT_WORKSPACES.map(role=>Object.freeze({identity:role.identity,name:role.identity.toUpperCase(),tool:role.tool,service:role.service})));
export function validCampaignSelection(value){return typeof value==='string'&&UUID.test(value)?value.toLowerCase():null;}
function roleFor(identity){
 if(typeof identity!=='string'||!Object.hasOwn(ROLES,identity))throw Error('Choose an available fundraising agent.');
 return ROLES[identity];
}
function checkedCampaign(value){
 if(value==null||value==='')return null;
 const id=validCampaignSelection(value);if(!id)throw Error('Choose a valid saved campaign.');return id;
}
export function agentWorkspaceHref(identity,campaignId=null){
 roleFor(identity);const query=new URLSearchParams({agent:identity}),id=checkedCampaign(campaignId);
 if(id)query.set('campaign',id);return '/agents?'+query;
}
// Only destinations that actually consume campaign selection receive it.
// Aggregate dashboards and public provider research deliberately remain generic.
export function agentToolHref(identity,campaignId=null){
 const role=roleFor(identity),id=checkedCampaign(campaignId);
 if(identity==='story')return agentWorkspaceHref(identity,id);
 const path=identity==='discover'?'/fundraising-partners':role.path;
 return id&&['echo','pulse'].includes(identity)?path+'?'+new URLSearchParams({campaign:id}):path;
}
export function parseAgentFeatureSelection(search=''){
 const query=new URLSearchParams(typeof search==='string'?search:''),requested=query.get('agent'),raw=query.get('campaign');
 const identity=typeof requested==='string'&&Object.hasOwn(ROLES,requested)?requested:null;
 return {identity,campaignId:validCampaignSelection(raw),invalidCampaign:raw!==null&&!validCampaignSelection(raw)};
}
// Membership must be checked against an already owner-verified response, never
// against public discovery results or a query parameter by itself.
export function campaignFromOwnedList(requested,campaigns,ownerId=null){
 const id=validCampaignSelection(requested);if(!id||!Array.isArray(campaigns))return '';
 return campaigns.some(row=>validCampaignSelection(row?.id)===id&&(!ownerId||row.owner_id==null||row.owner_id===ownerId))?id:'';
}
