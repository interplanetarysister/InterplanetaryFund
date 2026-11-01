// A linked fundraiser remains on its provider's payment rails. Never infer
// campaign-creation/publishing authority from a connection or a public URL.
const PROVIDER_HOSTS = Object.freeze({
  gofundme: ['gofundme.com'],
  kickstarter: ['kickstarter.com'],
  indiegogo: ['indiegogo.com'],
  fundrazr: ['fundrazr.com'],
  givesendgo: ['givesendgo.com'],
  spotfund: ['spotfund.com'],
  kofi: ['ko-fi.com'],
  buymeacoffee: ['buymeacoffee.com'],
  patreon: ['patreon.com'],
  justgiving: ['justgiving.com'],
  eventbrite: ['eventbrite.com'],
});

export function validExternalFundraiserUrl(platform, candidate) {
  try {
    const url = new URL(String(candidate || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return null;
    const known = PROVIDER_HOSTS[String(platform || '').toLowerCase()];
    if (known && !known.some(domain => host === domain || host === `www.${domain}`)) return null;
    if (!known && platform !== 'custom') return null;
    // A provider homepage is not an actual external fundraiser.
    if (!url.pathname || url.pathname === '/') return null;
    url.hash = '';
    return url.toString();
  } catch (_) { return null; }
}

export async function resolveDonationDestination(sr, userId, campaignId, connectionId) {
  const localUrl = `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaignId)}?donate=true`;
  if (!connectionId) return { kind: 'ifund', platform: 'ifund', url: localUrl };
  const connection = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
  if (!connection || connection.created_by_id !== userId ||
    connection.campaign_id !== campaignId ||
    connection.kind !== 'crowdfunding' ||
    connection.status !== 'connected' || connection.verification_status !== 'verified') {
    throw new Error('Selected external fundraiser is not an eligible connected campaign.');
  }
  const url = validExternalFundraiserUrl(connection.platform, connection.external_url);
  if (!url) throw new Error('Selected external fundraiser needs a valid official campaign URL.');
  return { kind: 'external', platform: connection.platform, url, connection_id: connection.id };
}
