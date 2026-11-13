import { selectedConnectionPlatform } from "./connectionCatalog.mjs";

// Public links are private bookmarks, not remote account credentials or
// proof of platform-authorized campaign totals.
const ALTERNATE_DOMAINS = Object.freeze({
  x:["twitter.com"],threads:["threads.com"],bluesky:["bsky.social"],
  kofi:["ko-fi.com"],discord:["discord.gg"],mastodon:["mastodon.social"]
});
export function validatePublicConnectionLink(providerId,raw) {
 const platform=selectedConnectionPlatform(providerId);
 if (!platform || platform.kind==="app") return {ok:false,message:"Choose a fundraising page or public social profile."};
 if (typeof raw!=="string" || raw.length<10 || raw.length>1500) return {ok:false,message:"Enter the full public page address."};
 let url;
 try { url=new URL(raw.trim()); } catch { return {ok:false,message:"Enter a valid page address starting with https://."}; }
 if (url.protocol!=="https:" || url.username || url.password || url.port ||
   !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname) ||
   /\.(local|localhost|internal)$/i.test(url.hostname)) {
   return {ok:false,message:"Use a secure public website address, not a private or sign-in link."};
 }
 const hosts=[...(platform.site?[new URL(platform.site).hostname.replace(/^www\./,"")]:[]),...(ALTERNATE_DOMAINS[providerId]||[])];
 if (!["custom","mastodon"].includes(providerId) &&
  !hosts.some(host=>url.hostname===host||url.hostname.endsWith("."+host))) {
   return {ok:false,message:"Use the public page address on "+platform.name+"."};
 }
 return {ok:true,url:url.href};
}
