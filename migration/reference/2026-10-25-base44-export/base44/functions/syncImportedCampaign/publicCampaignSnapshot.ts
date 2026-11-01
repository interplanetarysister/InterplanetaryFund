const HOSTS: Record<string, string[]> = {
  gofundme: ['gofundme.com'],
  kickstarter: ['kickstarter.com'],
  indiegogo: ['indiegogo.com'],
  fundrazr: ['fundrazr.com'],
  givesendgo: ['givesendgo.com'],
  kofi: ['ko-fi.com'],
  buymeacoffee: ['buymeacoffee.com'],
  patreon: ['patreon.com'],
  spotfund: ['spotfund.com'],
  eventbrite: ['eventbrite.com'],
};

function hostAllowed(platform: string, host: string) {
  return (HOSTS[platform] || []).some((domain) => host === domain || host.endsWith('.' + domain));
}

function decode(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function readMeta(html: string, key: string) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '';
    if (property.toLowerCase() !== key.toLowerCase()) continue;
    const value = tag.match(/content=["']([^"']*)["']/i)?.[1] || '';
    if (value) return decode(value.trim());
  }
  return '';
}

function readTitle(html: string) {
  return readMeta(html, 'og:title') || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '');
}

async function readTextLimited(response: Response, maxBytes = 2_000_000) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('provider_page_too_large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function assertAllowedUrl(platform: string, url: URL) {
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hostAllowed(platform, url.hostname.toLowerCase())
  ) throw new Error('provider_url_not_allowed');
}

export async function discoverPublicCampaignSnapshot(connection: any) {
  const platform = String(connection?.platform || '').toLowerCase();
  let current = new URL(String(connection?.external_url || ''));
  assertAllowedUrl(platform, current);

  let html = '';
  for (let hop = 0; hop < 3; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(current.toString(), {
        redirect: 'manual',
        headers: {
          'user-agent': 'InterplanetaryFund-CampaignImport/1.0',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      if (response.status >= 200 && response.status < 300) {
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          throw new Error('provider_content_type_invalid');
        }
        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(declaredLength) && declaredLength > 2_000_000) {
          throw new Error('provider_page_too_large');
        }
        html = await readTextLimited(response, 2_000_000);
        break;
      }

      if (response.status < 300 || response.status >= 400) throw new Error('provider_read_failed');
      const location = response.headers.get('location');
      if (!location) throw new Error('provider_redirect_invalid');
      current = new URL(location, current);
      assertAllowedUrl(platform, current);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!html) throw new Error('provider_read_failed');
  const description = readMeta(html, 'og:description') || readMeta(html, 'description');
  const title = readTitle(html).slice(0, 200);
  if (!title) throw new Error('provider_snapshot_missing_title');

  return {
    campaign: {
      title,
      summary: description.slice(0, 1000),
      story: description.slice(0, 30000),
      cover_image_url: readMeta(html, 'og:image').slice(0, 2000),
      category: 'other',
    },
    source_url: current.toString(),
    source: 'provider_public_campaign_page',
  };
}
