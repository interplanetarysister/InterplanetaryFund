// Render IFund embeds as a native campaign card rather than injecting
// arbitrary iframe/HTML markup. Copy-and-paste works in blogs and profiles.
export const IFUND_CAMPAIGN_ID = /^[A-Za-z0-9_-]{8,72}$/;
export function extractCampaignIds(input) {
  const text = String(input || "");
  const expressions = [
    /\[campaign:([A-Za-z0-9_-]{8,72})\]/gi,
    /https?:\/\/(?:www\.)?interplanetaryfund\.com\/(?:embed\/)?campaign\/([A-Za-z0-9_-]{8,72})/gi,
  ];
  return [...new Set(expressions.flatMap(re => [...text.matchAll(re)].map(x=>x[1])))].slice(0,8);
}
export function splitCampaignContent(raw) {
  const text = String(raw||"").slice(0,19000);
  const tokens = /\[campaign:([A-Za-z0-9_-]{8,72})\]|<iframe\b[^>]*src=["'](?:https?:\/\/(?:www\.)?interplanetaryfund\.com)?\/embed\/campaign\/([A-Za-z0-9_-]{8,72})[^"']*["'][^>]*><\/iframe>|https?:\/\/(?:www\.)?interplanetaryfund\.com\/(?:embed\/)?campaign\/([A-Za-z0-9_-]{8,72})(?:\?[^\s<]*)?/gi;
  const blocks = [];
  let last = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > last) blocks.push({type:"text",value:text.slice(last,match.index)});
    blocks.push({type:"campaign",id:match[1]||match[2]||match[3]});
    last = match.index + match[0].length;
  }
  if (last < text.length)blocks.push({type:"text",value:text.slice(last)});
  return blocks.length?blocks:[{type:"text",value:text}];
}
export function embedSnippet(id){
  if(!IFUND_CAMPAIGN_ID.test(String(id||"")))return "";
  return `<iframe src="https://interplanetaryfund.com/embed/campaign/${id}" title="Support campaign on Interplanetary Fund" loading="lazy" width="360" height="420" style="border:0;max-width:100%"></iframe>`;
}
