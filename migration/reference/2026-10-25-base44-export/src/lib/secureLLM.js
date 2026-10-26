import { externalCampaignAssistantEnabled, invokeCampaignAssistant } from './campaignAssistantProvider';
import { base44 } from "@/api/base44Client";
import { buildSecurePrompt, validateLLMObject } from "@/lib/promptSecurity";

// Central AI gateway: keeps instructions separate from untrusted data and
// validates returned text before it reaches UI, persistence, or messaging.
export async function secureInvokeLLM({ task, trustedContext = "", untrusted = [], response_json_schema, featureKey }) {
  if (featureKey === 'ai_campaign_assistant' && externalCampaignAssistantEnabled) {
    const properties = response_json_schema?.properties || {};
    const output = properties.options ? 'options' : properties.story ? 'story' : '';
    if (!output) throw Error('Unsupported campaign writing request');
    return validateLLMObject(await invokeCampaignAssistant({ kind: 'text', output,
      prompt: buildSecurePrompt({ task, trustedContext, untrusted }) }));
  }
  // The feature gate prevents client-initiated metered AI calls when disabled.
  // Server-side metered gateways must ALSO enforce their own authorization.
  if (featureKey) {
    const { data } = await base44.functions.invoke('getFeatureAvailability', {});
    if (data?.available?.[featureKey] !== true) throw new Error('Feature not enabled');
  }
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildSecurePrompt({ task, trustedContext, untrusted }),
    ...(response_json_schema ? { response_json_schema } : {}),
  });
  return validateLLMObject(result);
}
