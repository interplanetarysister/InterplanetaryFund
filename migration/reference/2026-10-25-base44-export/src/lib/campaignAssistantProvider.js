import { appParams } from '@/lib/app-params';

// Endpoint is an explicit deployment switch. Do not silently fall back to
// Base44 generation (and its credits) after an external-provider failure.
const endpoint = String(import.meta.env.VITE_CAMPAIGN_ASSISTANT_URL || '').trim();
export const externalCampaignAssistantEnabled = Boolean(endpoint);
export async function invokeCampaignAssistant(body) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid campaign assistant configuration');
  const token = String(appParams.token || '').trim();
  if (!token) throw Error('Sign in again to use campaign assistance.');
  const response = await fetch(url.href, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw Error('Campaign assistance is temporarily unavailable. Your work is unchanged.');
  return response.json();
}
