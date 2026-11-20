// Per-provider fundraiser URL validation. The URL is a reference, not proof of
// campaign ownership, permission to publish, or verified provider payments.
export const FUNDRAISER_PROVIDERS = Object.freeze({
  gofundme: { label: "GoFundMe", hosts: ["gofundme.com","www.gofundme.com"], path: /^\/f\/[a-z0-9_-]+\/?$/i },
  givebutter: { label: "Givebutter", hosts: ["givebutter.com","www.givebutter.com"], path: /^\/(?:c\/)?[a-z0-9_-]+(?:\/[a-z0-9_-]+)?\/?$/i },
  fundrazr: { label: "FundRazr", hosts: ["fundrazr.com","www.fundrazr.com"], path: /^\/(?:campaigns\/[a-z0-9_-]+(?:\/ab\/[a-z0-9_-]+)?|[a-z0-9_-]+)\/?$/i },
});
export function identifyExternalFundraiser(raw) {
  if (typeof raw !== "string" || raw.length > 2048) throw Error("Paste your fundraiser's link.");
  let url;
  try { url = new URL(raw.trim()); } catch { throw Error("Paste a complete HTTPS fundraiser link."); }
  const provider = Object.keys(FUNDRAISER_PROVIDERS)
    .find(key => FUNDRAISER_PROVIDERS[key].hosts.includes(url.hostname.toLowerCase()));
  if (!provider) throw Error("This fundraising site is not connected yet. Try GoFundMe, Givebutter, or FundRazr.");
  return { platform: provider, url: canonicalExternalFundraiserUrl(provider, raw) };
}
export function suggestedFundraiserTitle(raw) {
  const { url } = identifyExternalFundraiser(raw);
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) || "Your fundraiser";
  const title = slug.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
  return title.length < 3 ? "Your fundraiser" : title.slice(0,160);
}
export function canonicalExternalFundraiserUrl(provider, raw) {
  const spec = FUNDRAISER_PROVIDERS[provider];
  if (!spec || typeof raw !== "string" || raw.length > 2048) throw Error("Choose a supported provider and its campaign page.");
  let url;
  try { url = new URL(raw.trim()); } catch { throw Error("Enter a valid campaign URL."); }
  if (url.protocol !== "https:" || !spec.hosts.includes(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port ||
      url.pathname.includes("%") || !spec.path.test(url.pathname) ||
      /(?:^|\/)(?:account|login|checkout|settings|admin|donate)(?:\/|$)/i.test(url.pathname)) {
    throw Error("Choose a direct HTTPS campaign page for this provider, not a login, checkout, or redirect.");
  }
  return url.origin.toLowerCase() + url.pathname.replace(/\/$/, "");
}
export function parseReportedAmount(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.trim()))
    throw Error("Enter a nonnegative amount with up to two decimal places.");
  const [d,c=""] = value.trim().split(".");
  const cents = Number(d)*100+Number(c.padEnd(2,"0"));
  if (!Number.isSafeInteger(cents) || cents>1000000000000) throw Error("Amount exceeds the supported tracking limit.");
  return cents;
}
export function groupReportedTotals(sources) {
  const totals={};
  for(const s of sources||[]) {
    if(s?.provenance!=="owner_reported"||s.amount_cents==null||!/^[A-Z]{3}$/.test(s.currency||"")||
       !Number.isSafeInteger(Number(s.amount_cents))||Number(s.amount_cents)<0) continue;
    totals[s.currency]=(totals[s.currency]||0)+Number(s.amount_cents);
    if(!Number.isSafeInteger(totals[s.currency])) throw Error("The reported totals cannot be safely combined.");
  }
  return totals;
}
