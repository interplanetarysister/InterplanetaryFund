import contracts from "../position-contracts.json" with { type: "json" };
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
    instructions: p.instructions,
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
