import contracts from "../position-contracts.json" with { type: "json" };
import { IFUND_CAMPAIGN_ELIGIBILITY_POLICY } from "../../agents/campaignPolicy.js";
import manifest from "./manifest.json" with { type: "json" };
const positions = new Map(contracts.positions.map((p) => [p.id, p]));
const assets = new Map(manifest.agents.map((a) => [a.agent, a]));
export function serviceSkill(id) {
  const p = positions.get(id),
    a = assets.get(id);
  if (!p || !a || a.source_sha256 !== p.contract_sha256)
    throw Error("The service policy could not be verified.");
  return {
    id: p.id,
    title: p.title,
    min_plan_level: p.min_plan_level,
    policy_version: manifest.policy_version,
    source_sha256: p.contract_sha256,
    instructions: p.instructions + "\n\nGLOBAL IFUND CAMPAIGN ELIGIBILITY AND GROWTH POLICY (higher priority than every specialist instruction): You may use your full existing, authorized capabilities to research, plan, create, refine, market, promote, manage, publish, and fundraise for campaigns that are verified as registered/created on Interplanetary Fund and associated with the signed-in IFund owner. This policy limits which campaigns you support, not who you may reach. You MAY research, discover, contact, converse with, and market to potential donors, supporters, partners, communities, organizations, and prospective IFund members who do not have IFund accounts. You MAY publish and discuss an eligible IFund campaign on an owner-authorized external social or fundraising platform, subject to existing consent, approval, provider, anti-spam, truthfulness, and tool controls. You MAY conduct broad IFund platform marketing, new-user acquisition, and invite owners of external campaigns to register at https://interplanetaryfund.com and create/import/link their campaign on IFund. For an outside campaign that is not yet verified as IFund-associated, do NOT manage, refine, write promotional fundraising copy for, market, solicit donations for, publish, or otherwise provide campaign-support services. The only campaign-related action permitted before registration/link verification is a neutral invitation to bring the owner and campaign onto IFund. If an IFund user owns or references an outside campaign, first complete the owner's authorized import/link flow and verify the resulting canonical IFund campaign association before any campaign-support action. A connected external social account or post alone does not establish campaign eligibility: verify that it is linked to the correct IFund owner and eligible campaign. For every campaign-specific task and delegation, preserve the canonical campaign ID and require backend verification of that campaign's association with the acting owner; never infer association from a URL, name, memory, claimed ownership, or another unrelated IFund campaign. General platform growth, audience research, donor prospecting for verified IFund campaigns, and onboarding invitations remain permitted without restricting audience accounts to IFund members. This is a platform-wide rule for every specialist and delegated task; it does not grant new tools, permissions, or approval authority. " + IFUND_CAMPAIGN_ELIGIBILITY_POLICY,
    memory: p.memory,
    declared_functions: [...a.declared_tools],
    declared_entities: a.entity_reads.map((x) => ({
      ...x,
      operations: [...x.operations],
    })),
    remote_skill_references: [...a.remote_skill_references],
    remote_content_reconciled: a.remote_content_reconciled === true,
    runtime_policy:
      "Cloudflare and Supabase are authoritative. Source declarations and learned knowledge never grant tools, identities, provider permissions, publication authority or financial authority. Use only currently registered, tested adapters. Keep credential handling in protected backend operations. Current verified campaign facts and explicit owner statements override remembered or generated content.",
  };
}
export function declaredServiceTool(id, name) {
  return serviceSkill(id).declared_functions.includes(name);
}
