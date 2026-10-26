export const CANONICAL_AGENT_IDS = {
  'Chief of Staff': 'solene',
  chief_of_staff: 'solene',
  'Strategy Agent': 'post_production',
  strategy_agent: 'post_production',
  'Story Agent': 'donor_relations',
  story_agent: 'donor_relations',
  'Growth Agent': 'scout',
  growth_agent: 'scout',
  'Communications Agent': 'platform_coordinator',
  communications_agent: 'platform_coordinator',
  'Finance Agent': 'finance',
  finance_agent: 'finance',
  'Outreach Agent': 'atlas',
  outreach_agent: 'atlas',
  Atlas: 'atlas',
  Solene: 'solene',
  'Post Production Agent': 'post_production',
  'Donor Relations Agent': 'donor_relations',
  'Scout Agent': 'scout',
  'Platform Coordinator Agent': 'platform_coordinator',
};

export function resolveCanonicalAgentId(name) {
  return CANONICAL_AGENT_IDS[name] || String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
