// Deterministic, immediately callable professional practice tool; no provider effects.
// These references are training sources, not claims of live research or new partnerships.
import { TEAM_CONTEXT_AGENTS,redactTeamCredentials } from "./teamContext.js";
import { assessAgentAction } from "./agentActionPolicy.mjs";
export const PRACTICE_VERSION="2026-11-20-v1";
const REFERENCES=Object.freeze({
 ethics:{publisher:"Association of Fundraising Professionals",url:"https://afpglobal.org/ethics/code-ethical-standards"},
 nonprofit:{publisher:"National Council of Nonprofits",url:"https://www.councilofnonprofits.org"},
 research:{publisher:"Candid",url:"https://learning.candid.org"}
});
const WORK=Object.freeze({
 nexus:{skill:"coordinate_specialists",sources:["ethics","research"],steps:["Clarify the goal and ownership","Assign complementary specialist deliverables","Verify claims before combining advice"]},
 story:{skill:"draft_truthful_story",sources:["ethics","research"],steps:["Extract owner-provided facts","Identify missing evidence and consent","Draft a respectful story for owner review"]},
 orbit:{skill:"review_budget",sources:["ethics","research"],steps:["Identify source and status of each amount","Separate external gifts from first-party records","Explain fees and gaps without changing money"]},
 echo:{skill:"draft_supporter_update",sources:["ethics","nonprofit"],steps:["Confirm audience consent and verified progress","Draft accessible supporter communication","Require approval before external sending"]},
 pulse:{skill:"evaluate_outreach",sources:["ethics","nonprofit"],steps:["Identify relevant communities and rules","Prepare personalized non-spam drafts","Request authorization before contacting anyone"]},
 polaris:{skill:"create_milestone_plan",sources:["research","ethics"],steps:["Break goals into verifiable milestones","Describe audience and assumptions","Specify measures without success guarantees"]},
 forge:{skill:"review_attribution",sources:["research","nonprofit"],steps:["Separate clicks, leads and verified gifts","Identify denominators and provenance","Suggest measurable experiments"]},
 link:{skill:"review_connection_readiness",sources:["nonprofit","ethics"],steps:["Identify platform and owner","Check only verified provider grant evidence","Propose least-privilege reconnection"]},
 discover:{skill:"review_opportunity_fit",sources:["research","ethics"],steps:["Identify possible funding sources","Mark current eligibility and dates unverified until checked","Prepare owner-reviewed shortlist"]}
});
export function runSpecialistPractice({agent,question,identityVerified=false,ownerScoped=false}={}){
 if(!TEAM_CONTEXT_AGENTS.includes(agent)||!Object.hasOwn(WORK,agent))throw Error("Unknown specialist");
 if(typeof question!=="string"||question.trim().length<8||question.length>2000)throw Error("Invalid question");
 const permission=assessAgentAction("practice_skill",{identityVerified,ownerScoped});
 if(!permission.allowed)throw Error("Verified owner context required for specialist tools");
 const rule=WORK[agent];
 return Object.freeze({
  agent,skill:rule.skill,version:PRACTICE_VERSION,status:"executed_local_advisory",
  question:redactTeamCredentials(question).slice(0,400),
  checklist:[...rule.steps],
  sources:rule.sources.map(k=>REFERENCES[k]),
  evidence:"question_only_unverified",actions_performed:false,
  external_actions:false,financial_operations:false
 });
}
