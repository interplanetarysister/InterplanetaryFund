/** Support is broader than cash fundraising. Used by Missions and campaign preparation.
 * Money remains separate from in-kind quantity; no invented USD valuation. */
export const SUPPORT_NEEDS=Object.freeze([
 {id:"unspecified",label:"Not sure yet",examples:"Describe what would help in your own words",cash:false},
 {id:"money",label:"Money, donations or investors",examples:"Donations, grants, sponsors, capital, financial aid",cash:true},
 {id:"transport",label:"Vehicles and transportation",examples:"Vehicles, repairs, replacement parts, transit passes, rides"},
 {id:"essentials",label:"Everyday essentials",examples:"Groceries, diapers, clothes, cleaners, cookware, school supplies"},
 {id:"home",label:"Housing and household needs",examples:"Rent, safe shelter, utilities, repairs, furniture"},
 {id:"care",label:"Health, accessibility and care",examples:"Caregiving, appointments, medical equipment, mobility aids"},
 {id:"people",label:"Emotional support and connections",examples:"Mentors, friends, networking, peer support, advocacy"},
 {id:"skills",label:"Volunteers and professional help",examples:"Teaching, legal help, training, labor, technical expertise"},
 {id:"equipment",label:"Equipment, tools and materials",examples:"Business equipment, computers, construction or art supplies"},
 {id:"learning",label:"Education and opportunities",examples:"Tutoring, courses, scholarships, apprenticeships"},
 {id:"community",label:"Community, animals and environmental needs",examples:"Community projects, rescue, supplies, conservation"},
 {id:"other",label:"Something else",examples:"Describe what would help you achieve your goal"}
]);
export function supportNeed(value){return SUPPORT_NEEDS.find(item=>item.id===value)||SUPPORT_NEEDS[0];}
// An unanswered optional selector is not a classification. Never write a
// fabricated "Support wanted" summary or investigation prompt for it.
export function missionSupportSummary(value){const need=supportNeed(value);return need.id==="unspecified"?"":"Support wanted: "+need.label;}
export function missionSupportPrompt(value){const need=supportNeed(value);return need.id==="unspecified"?"":"\nType of support to investigate: "+need.label;}
export function missionSupportFields(value){const summary=missionSupportSummary(value);return summary?{summary}:{};}
export function missionGoalTypeForSupport(value){
 const id=supportNeed(value).id;
 return ({money:"personal",transport:"personal",essentials:"emergency",home:"personal",
   care:"personal",people:"personal",skills:"education",equipment:"business",
   learning:"education",community:"community",other:"other"})[id]||"other";
}
