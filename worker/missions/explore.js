// What If? Engine — deterministic, zero-provider-cost guest exploration.
// Never persists a prompt, calls an AI vendor, sends mail, publishes, or creates a campaign.
import { readJsonBody, BodyError } from "../bodyLimit.js";

const respond=(status,value)=>Response.json(value,{
 status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}
});
function describe(prompt){
 const clean=prompt.trim().replace(/\s+/g," ");
 const intro=clean.length>240?clean.slice(0,239)+"…":clean;
 // These are planning prompts, not extracted claims about aid or eligibility.
 return {
  understood:"You would like help making this possible: "+intro,
  provisional:true,
  privacy:"This response is not saved to an iFund account or published.",
  confidence:"user_prompt_only",
  assumptions:[],
  questions:[
   {id:"priority",text:"What matters most about the outcome or deadline?",optional:true},
   {id:"resources",text:"What resources or help do you already have available?",optional:true}
  ],
  pathways:[
   {kind:"plan",title:"Clarify the goal",next_step:"Describe what success would look like and any important constraints.",verification:"owner_input_required"},
   {kind:"resources",title:"Explore non-fundraising options",next_step:"Check relevant assistance, reusable resources, services, and willing collaborators.",verification:"not_yet_researched"},
   {kind:"fundraising",title:"Consider fundraising only if useful",next_step:"Identify any remaining financial gap before deciding whether to create a campaign.",verification:"not_yet_researched"}
  ],
  actions:[{id:"save",label:"Save a private Mission",requires_login:true},
   {id:"manual",label:"Continue planning manually",requires_login:false}],
  provider_actions_executed:0,provider_funding_confirmed:false
 };
}
export async function routeMissionExplore(request,env={}){
 if(request.method!=="POST")return respond(405,{error:"Method not allowed."});
 if(env.IFUND_WHAT_IF_ENABLED!=="enabled")return respond(503,{
  code:"mission_explore_disabled",error:"What If? exploration is not available in this environment yet."
 });
 try{
  const body=await readJsonBody(request,16384);
  if(!body||typeof body!=="object"||Array.isArray(body))
   return respond(400,{error:"Provide a JSON object with a prompt."});
  if(typeof body.prompt!=="string"||body.prompt.length>12000||!body.prompt.trim())
   return respond(400,{error:"Describe what you would like to accomplish in 1–12,000 characters."});
  return respond(200,describe(body.prompt));
 }catch(err){
  if(err instanceof BodyError)return respond(err.status,{error:err.message});
  return respond(400,{error:"Could not parse your request."});
 }
}