// Independent member catalog, curated from the Base44 reference. UI-only catalog:
// no imported credentials, connection claims, provider authorizations, or fees.
export const CONNECTION_PLATFORMS = Object.freeze([
  {
    "id": "justgiving",
    "name": "JustGiving",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.justgiving.com",
    "accent": "#ee2b63",
    "icon": "justgiving"
  },
  {
    "id": "gofundme",
    "name": "GoFundMe",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.gofundme.com",
    "accent": "#00b964",
    "icon": "gofundme"
  },
  {
    "id": "kickstarter",
    "name": "Kickstarter",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.kickstarter.com",
    "accent": "#05ce78",
    "icon": "kickstarter"
  },
  {
    "id": "indiegogo",
    "name": "Indiegogo",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.indiegogo.com",
    "accent": "#eb1478",
    "icon": "indiegogo"
  },
  {
    "id": "fundrazr",
    "name": "FundRazr",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://fundrazr.com",
    "accent": "#0066cc",
    "icon": "fundrazr"
  },
  {
    "id": "fundly",
    "name": "Fundly",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://fundly.com",
    "accent": "#00a651",
    "icon": "fundly"
  },
  {
    "id": "givesendgo",
    "name": "GiveSendGo",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.givesendgo.com",
    "accent": "#3b82f6",
    "icon": "givesendgo"
  },
  {
    "id": "kofi",
    "name": "Ko-fi",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://ko-fi.com",
    "accent": "#ff5e5b",
    "icon": "kofi"
  },
  {
    "id": "buymeacoffee",
    "name": "Buy Me a Coffee",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.buymeacoffee.com",
    "accent": "#ffdd00",
    "icon": "buymeacoffee"
  },
  {
    "id": "patreon",
    "name": "Patreon",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.patreon.com",
    "accent": "#ff424d",
    "icon": "patreon"
  },
  {
    "id": "spotfund",
    "name": "Spotfund",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.spotfund.com",
    "accent": "#8b5cf6",
    "icon": "spotfund"
  },
  {
    "id": "eventbrite",
    "name": "Eventbrite",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://www.eventbrite.com",
    "accent": "#f05537",
    "icon": "eventbrite"
  },
  {
    "id": "gumroad",
    "name": "Gumroad",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://gumroad.com",
    "accent": "#ff90e8",
    "icon": "gumroad"
  },
  {
    "id": "custom",
    "name": "Custom Campaign URL",
    "kind": "crowdfunding",
    "method": "link",
    "site": "",
    "accent": "#64748b",
    "icon": "custom"
  },
  {
    "id": "givebutter",
    "name": "Givebutter",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://givebutter.com",
    "accent": "#00b0ff",
    "icon": "givebutter"
  },
  {
    "id": "donorbox",
    "name": "Donorbox",
    "kind": "crowdfunding",
    "method": "link",
    "site": "https://donorbox.org",
    "accent": "#1a2b4b",
    "icon": "donorbox"
  },
  {
    "id": "wordpress_com",
    "name": "WordPress.com",
    "kind": "social",
    "method": "link",
    "site": "https://wordpress.com",
    "accent": "#21759b",
    "icon": "wordpress"
  },
  {
    "id": "bluesky",
    "name": "Bluesky",
    "kind": "social",
    "method": "link",
    "site": "https://bsky.app",
    "accent": "#0085ff",
    "icon": "bluesky"
  },
  {
    "id": "mastodon",
    "name": "Mastodon",
    "kind": "social",
    "method": "link",
    "site": "https://joinmastodon.org",
    "accent": "#6364ff",
    "icon": "mastodon"
  },
  {
    "id": "facebook",
    "name": "Facebook",
    "kind": "social",
    "method": "secure",
    "site": "https://www.facebook.com",
    "accent": "#1877f2",
    "icon": "facebook"
  },
  {
    "id": "instagram",
    "name": "Instagram",
    "kind": "social",
    "method": "secure",
    "site": "https://www.instagram.com",
    "accent": "#e1306c",
    "icon": "instagram"
  },
  {
    "id": "threads",
    "name": "Threads",
    "kind": "social",
    "method": "link",
    "site": "https://www.threads.net",
    "accent": "#101010",
    "icon": "threads"
  },
  {
    "id": "x",
    "name": "X (Twitter)",
    "kind": "social",
    "method": "secure",
    "site": "https://x.com",
    "accent": "#000000",
    "icon": "x"
  },
  {
    "id": "linkedin",
    "name": "LinkedIn",
    "kind": "social",
    "method": "secure",
    "site": "https://www.linkedin.com",
    "accent": "#0a66c2",
    "icon": "linkedin"
  },
  {
    "id": "tiktok",
    "name": "TikTok",
    "kind": "social",
    "method": "secure",
    "site": "https://www.tiktok.com",
    "accent": "#010101",
    "icon": "tiktok"
  },
  {
    "id": "pinterest",
    "name": "Pinterest",
    "kind": "social",
    "method": "link",
    "site": "https://www.pinterest.com",
    "accent": "#e60023",
    "icon": "pinterest"
  },
  {
    "id": "reddit",
    "name": "Reddit",
    "kind": "social",
    "method": "link",
    "site": "https://www.reddit.com",
    "accent": "#ff4500",
    "icon": "reddit"
  },
  {
    "id": "youtube",
    "name": "YouTube",
    "kind": "social",
    "method": "secure",
    "site": "https://www.youtube.com",
    "accent": "#ff0000",
    "icon": "youtube"
  },
  {
    "id": "discord",
    "name": "Discord",
    "kind": "social",
    "method": "link",
    "site": "https://discord.com",
    "accent": "#5865f2",
    "icon": "discord"
  },
  {
    "id": "gmail",
    "name": "Gmail",
    "kind": "app",
    "method": "guide",
    "site": "https://mail.google.com",
    "accent": "#64748b",
    "icon": "gmail"
  },
  {
    "id": "googledrive",
    "name": "Google Drive",
    "kind": "app",
    "method": "guide",
    "site": "https://drive.google.com",
    "accent": "#64748b",
    "icon": "googledrive"
  },
  {
    "id": "googlecalendar",
    "name": "Google Calendar",
    "kind": "app",
    "method": "guide",
    "site": "https://calendar.google.com",
    "accent": "#64748b",
    "icon": "googlecalendar"
  },
  {
    "id": "google_contacts",
    "name": "Google Contacts",
    "kind": "app",
    "method": "guide",
    "site": "https://contacts.google.com",
    "accent": "#64748b",
    "icon": "googlecontacts"
  },
  {
    "id": "google_photos",
    "name": "Google Photos",
    "kind": "app",
    "method": "guide",
    "site": "https://photos.google.com",
    "accent": "#64748b",
    "icon": "googlephotos"
  },
  {
    "id": "googlesheets",
    "name": "Google Sheets",
    "kind": "app",
    "method": "guide",
    "site": "https://sheets.google.com",
    "accent": "#64748b",
    "icon": "googlesheets"
  },
  {
    "id": "googledocs",
    "name": "Google Docs",
    "kind": "app",
    "method": "guide",
    "site": "https://docs.google.com",
    "accent": "#64748b",
    "icon": "googledocs"
  },
  {
    "id": "googleforms",
    "name": "Google Forms",
    "kind": "app",
    "method": "guide",
    "site": "https://forms.google.com",
    "accent": "#64748b",
    "icon": "googleforms"
  },
  {
    "id": "googletasks",
    "name": "Google Tasks",
    "kind": "app",
    "method": "guide",
    "site": "https://tasks.google.com",
    "accent": "#64748b",
    "icon": "googletasks"
  },
  {
    "id": "slack",
    "name": "Slack",
    "kind": "app",
    "method": "guide",
    "site": "https://slack.com",
    "accent": "#64748b",
    "icon": "slack"
  },
  {
    "id": "notion",
    "name": "Notion",
    "kind": "app",
    "method": "guide",
    "site": "https://www.notion.so",
    "accent": "#64748b",
    "icon": "notion"
  },
  {
    "id": "outlook",
    "name": "Outlook",
    "kind": "app",
    "method": "guide",
    "site": "https://outlook.live.com",
    "accent": "#64748b",
    "icon": "microsoftoutlook"
  },
  {
    "id": "microsoft_teams",
    "name": "Microsoft Teams",
    "kind": "app",
    "method": "guide",
    "site": "https://teams.microsoft.com",
    "accent": "#64748b",
    "icon": "microsoftteams"
  },
  {
    "id": "one_drive",
    "name": "OneDrive",
    "kind": "app",
    "method": "guide",
    "site": "https://onedrive.live.com",
    "accent": "#64748b",
    "icon": "onedrive"
  },
  {
    "id": "dropbox",
    "name": "Dropbox",
    "kind": "app",
    "method": "guide",
    "site": "https://www.dropbox.com",
    "accent": "#64748b",
    "icon": "dropbox"
  },
  {
    "id": "github",
    "name": "GitHub",
    "kind": "app",
    "method": "guide",
    "site": "https://github.com",
    "accent": "#64748b",
    "icon": "github"
  },
  {
    "id": "gitlab",
    "name": "GitLab",
    "kind": "app",
    "method": "guide",
    "site": "https://gitlab.com",
    "accent": "#64748b",
    "icon": "gitlab"
  },
  {
    "id": "google",
    "name": "Google Account",
    "kind": "app",
    "method": "secure",
    "site": "https://accounts.google.com",
    "accent": "#4285F4",
    "icon": "google"
  }
].map(row=>Object.freeze(row)));
export const OAUTH_PLATFORM_IDS = Object.freeze({ facebook:"facebook_pages",instagram:"instagram",youtube:"youtube",linkedin:"linkedin",tiktok:"tiktok",x:"x",google:"google" });
export const CONNECTION_PROVIDER_ALIASES = Object.freeze({
 facebook_pages:["facebook_pages","facebook"],instagram:["instagram","instagram_business"],
 youtube:["youtube","youtube_channel"],google:["google","google_account"],
 linkedin:["linkedin"],tiktok:["tiktok"],x:["x","twitter"]
});
export function matchesStoredConnection(row,providerId) {
 return Boolean(row && (CONNECTION_PROVIDER_ALIASES[providerId] || [providerId]).includes(row.provider));
}
export const PLATFORM_KIND_NAMES = Object.freeze({all:"All platforms",crowdfunding:"Fundraising",social:"Social & sharing",app:"Apps & productivity"});
export function selectedConnectionPlatform(id) { return CONNECTION_PLATFORMS.find(row=>row.id===id)||null; }
export function connectionSteps(platform,{secure=false,hasSavedLink=false}={}) {
 if (!platform) return [];
 if (secure) return ["Select Connect securely below.", "Sign in on "+platform.name+" with your own account.", "Review the request on "+platform.name+" and approve only what you wish to share.", "Return to iFund to see your connected account."];
 if (platform.kind==="app") return ["Open "+platform.name+" using the link below.", "Sign in to your account there.", "When secure connection becomes available here, choose Connect securely to link the account."];
 return ["Open your existing "+platform.name+" "+(platform.kind==="crowdfunding"?"fundraiser":"profile")+" page.", "Copy its public page address.", hasSavedLink?"Use Update link below to replace the saved address.":"Paste the page address below and choose Save link.", "Your link will be saved privately in iFund. Account access and publishing are separate choices."];
}
