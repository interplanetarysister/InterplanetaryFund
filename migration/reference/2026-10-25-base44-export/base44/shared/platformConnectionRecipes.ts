// Canonical non-secret connection-routing knowledge used by IFund connection functions.
// Keep provider transport architecture here so status, discovery, and repair cannot drift apart.
// This file contains no user credentials, OAuth tokens, browser sessions, account IDs,
// campaign IDs, or user consent.

export const TRANSPORT_PRIORITY = [
  'oauth',
  'api',
  'webhook',
  'token',
  'authenticated_browser',
  'public_browser',
  'manual',
];

export const STATIC_CONNECTION_RECIPES: Record<string, Record<string, any>> = {
  linkedin: { connect: { preferred_transport: 'oauth', connector_type: 'linkedin' } },
  facebook: { connect: { preferred_transport: 'oauth', connector_type: 'facebook_pages' } },
  instagram: { connect: { preferred_transport: 'oauth', connector_type: 'instagram' } },
  discord: { connect: { preferred_transport: 'oauth', connector_type: 'discord' } },
  tiktok: { connect: { preferred_transport: 'oauth', connector_type: 'tiktok' } },
  eventbrite: { connect: { preferred_transport: 'oauth', connector_type: 'eventbrite' } },
  patreon: { connect: { preferred_transport: 'oauth', connector_type: 'patreon' } },
  kofi: { connect: { preferred_transport: 'webhook', worker_key: 'kofiWebhook' } },
  buymeacoffee: { connect: { preferred_transport: 'token', worker_key: 'buyMeACoffeeApi' } },
  bluesky: { connect: { preferred_transport: 'token', worker_key: 'blueskyDirect' } },
  mastodon: { connect: { preferred_transport: 'token', worker_key: 'mastodonDirect' } },
  gofundme: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  justgiving: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  kickstarter: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  indiegogo: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  fundrazr: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  givesendgo: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  spotfund: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  wix: { connect: { preferred_transport: 'oauth', connector_type: 'wix', shared: true } },
};

export function staticRecipe(platform: string, operation = 'connect') {
  return STATIC_CONNECTION_RECIPES[platform]?.[operation] || null;
}

export function orderedTransports(recipe: any) {
  const successful = recipe?.successful_route;
  const preferred = recipe?.preferred_transport;
  const candidates = Array.isArray(recipe?.candidate_transports) ? recipe.candidate_transports : [];
  const fallbacks = Array.isArray(recipe?.fallback_transports) ? recipe.fallback_transports : [];
  const blocked = new Set(Array.isArray(recipe?.blocked_routes) ? recipe.blocked_routes : []);
  const priority = new Map(TRANSPORT_PRIORITY.map((transport, index) => [transport, index]));
  const explicit = [...new Set([successful, preferred, ...candidates, ...fallbacks].filter(Boolean))];
  return explicit
    .filter((transport) => priority.has(transport) && !blocked.has(transport))
    .sort((left, right) => priority.get(left)! - priority.get(right)!);
}

export function requiresRouteRediscovery(recipe: any, transports = orderedTransports(recipe)) {
  const executable = transports.filter((transport: string) => transport !== 'manual');
  return !recipe
    || recipe.status === 'stale'
    || recipe.discovery_state === 'exhausted'
    || executable.length === 0;
}
