// Member-visible plan descriptions. Only provider-backed catalog and entitlement
// responses can enable a purchase or grant access; this file is presentation.
export const PLAN_DISPLAY = Object.freeze({
  free:{name:"Free",eyebrow:"Included with your account",description:"Create and manage campaigns, use available free tools, and connect supported services.",features:["Campaign creation, saving and public sharing","Campaign discovery and fundraising guidance","Manual social copy and public page links","Verified provider connections where supported","Free readiness and owner analytics tools"],note:"No automatic external posting or guaranteed AI inference is included."},
  basic:{name:"Basic AI Assistant",eyebrow:"Individual creator",description:"Paid AI writing access where a verified iFund service entitlement is enabled.",features:["Verified paid Story assistant entitlement","Private draft review and account-owned workspace","Existing free campaigning and connection tools"],note:"AI access still requires a verified account, available provider capacity, and the applicable AI permission."},
  outreach:{name:"AI Outreach Agent",eyebrow:"Outreach workflows",description:"Proposed assisted outreach tier, pending independent provider capability and billing verification.",features:["Planned outreach recommendations","Planned draft-first communication assistance"],note:"Automatic sending and paid feature enforcement are not verified. Enrollment unavailable."},
  professional:{name:"Professional Outreach",eyebrow:"Growing campaigns",description:"Proposed professional support, pending verified entitlements.",features:["Planned multi-channel campaign coordination","Planned enhanced reporting and outreach review"],note:"This plan is not accepting enrollment."},
  enterprise:{name:"Enterprise",eyebrow:"Organization workflows",description:"Proposed organization capabilities subject to contracts and provider verification.",features:["Planned organizational workflows","Planned permissions and analytics"],note:"This plan is not accepting enrollment."},
  nonprofit:{name:"Nonprofit",eyebrow:"Mission-focused teams",description:"Proposed nonprofit workflows subject to verification.",features:["Planned coordinated fundraising tools","Planned campaign communication support"],note:"This plan is not accepting enrollment."},
});
export const PLAN_ORDER=Object.freeze(["basic","outreach","professional","nonprofit","enterprise"]);
export function validProviderPlan(plan) {
  return Boolean(plan && PLAN_ORDER.includes(plan.tier) &&
    ["monthly","annual"].includes(plan.interval) &&
    plan.currency==="USD" &&
    Number.isSafeInteger(plan.amount_cents) && plan.amount_cents>0);
}
export function canEnroll(plan,{native=false,statusLoad="unavailable",hasSubscription=false}={}) {
  return validProviderPlan(plan) && plan.available===true && plan.verified===true &&
    !native && statusLoad==="ready" && !hasSubscription;
}
export function displayPrice(plan){
  if(!validProviderPlan(plan))return "Price unavailable";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(plan.amount_cents/100);
}
