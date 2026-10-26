import { base44 } from '@/api/base44Client';
import { resolveCanonicalAgentId } from './agentIdentity';

export async function recordAgentInteraction({ agentName, summary, outcome, campaignId, approved } = {}) {
  if (!agentName || !summary) return null;
  try {
    return await base44.functions.invoke('recordAgentInteraction', {
      canonicalAgentId: resolveCanonicalAgentId(agentName),
      source: 'base44_agent_chat',
      action: 'conversation',
      summary,
      outcome,
      campaignId,
      approved,
    });
  } catch (error) {
    // Agent persistence must never break the user's conversation.
    console.warn('Agent memory sync failed:', error);
    return null;
  }
}
