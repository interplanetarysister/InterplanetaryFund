// Official provider homepages. This is a user-directed sign-up handoff,
// NOT proof that IFund created an account or connected publishing permission.
const OFFICIAL_SITES = Object.freeze({
  gofundme: 'https://www.gofundme.com/',
  kickstarter: 'https://www.kickstarter.com/',
  indiegogo: 'https://www.indiegogo.com/',
  fundrazr: 'https://fundrazr.com/',
  givesendgo: 'https://www.givesendgo.com/',
  kofi: 'https://ko-fi.com/',
  buymeacoffee: 'https://www.buymeacoffee.com/',
  patreon: 'https://www.patreon.com/',
  spotfund: 'https://www.spotfund.com/',
  eventbrite: 'https://www.eventbrite.com/',
  gumroad: 'https://gumroad.com/',
  bluesky: 'https://bsky.app/',
  mastodon: 'https://joinmastodon.org/',
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  threads: 'https://www.threads.net/',
  x: 'https://x.com/',
  linkedin: 'https://www.linkedin.com/',
  tiktok: 'https://www.tiktok.com/',
  pinterest: 'https://www.pinterest.com/',
  reddit: 'https://www.reddit.com/',
  youtube: 'https://www.youtube.com/',
  discord: 'https://discord.com/',
});
export function officialProviderSite(platform) {
  return OFFICIAL_SITES[String(platform || '').toLowerCase()] || '';
}
