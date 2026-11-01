// IFund embedded campaigns are never rendered from arbitrary submitted HTML.
// Recognize the supported iframe snippet, canonical campaign URL, and token;
// convert all of them into a safe reference rendered by the native card.
export const EMBED_ID = /^[a-zA-Z0-9_-]{8,72}$/;
export function campaignIdsFromText(text: string): string[] {
  const src = String(text || '').slice(0, 22000);
  const matches = [
    ...src.matchAll(/\[campaign:([a-zA-Z0-9_-]{8,72})\]/gi),
    ...src.matchAll(/https?:\/\/(?:www\.)?interplanetaryfund\.com\/(?:embed\/)?campaign\/([a-zA-Z0-9_-]{8,72})/gi),
  ];
  return [...new Set(matches.map(match => match[1]))].slice(0, 8);
}
export function normalizeCampaignEmbeds(input: unknown) {
  let result = String(input ?? '').slice(0, 18000);
  result = result.replace(/<iframe\b[^>]*src=["'](?:https?:\/\/(?:www\.)?interplanetaryfund\.com)?\/embed\/campaign\/([a-zA-Z0-9_-]{8,72})[^"']*["'][^>]*>\s*<\/iframe>/gi,
    (_whole, id) => `\n[campaign:${id}]\n`);
  result = result.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '[Unsupported embed removed]');
  result = result.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return result;
}
