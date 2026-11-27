// In-IFund authorization request for member provider connections.
//
// Before a member is sent to a provider's sign-in page, Connections.jsx shows
// this request and requires an explicit tick for the persistent link. The
// provider's own consent screen is the second authorization step: the member
// signs in there with their own account and approves only what IFund asked
// for. Nothing here is a publishing grant — connecting an account never posts
// for the member, and publishing stays a separate, explicitly approved step.
//
// Scope lists mirror worker/oauth.js exactly (same raw scope strings, same
// order). If a scope changes in the worker, update the matching entry here
// and in apps/web/tests/oauth-consent.test.js — the test pins parity.
// Approval flags and env binding names are names only; no values live here.

export const OAUTH_CONSENT_SHARED = Object.freeze({
  stored:
    "IFund stores an encrypted access token (and a refresh token where the provider issues one), " +
    "your provider account id, the permissions the provider actually granted, and when the token expires. " +
    "Tokens are encrypted before they are stored, and only IFund's server can read them.",
  persistent:
    "This is a persistent link: your account stays connected until you disconnect it here, " +
    "the token expires without a refresh token to renew it, or you remove IFund's access in the provider's own account settings.",
  publishing:
    "Connecting does not publish anything. IFund will not post, share, or send messages on this account. " +
    "Anything published outside IFund needs its own separate approval from you first.",
  disconnect:
    "You can disconnect at any time from this page. Disconnecting removes IFund's saved access and " +
    "stops future use of the link. It does not delete anything already on the provider, and you can also " +
    "remove IFund's access in the provider's own account settings.",
  financial:
    "IFund never asks for financial authority, banking access, or payment permissions through this connection.",
});

export function persistentLinkAgreement(providerName) {
  return (
    "I understand — keep " +
    providerName +
    " connected to my iFund account until I disconnect it."
  );
}

export const OAUTH_CONSENT_PROVIDERS = Object.freeze(
  [
    {
      id: "google",
      name: "Google Account",
      scopes: ["openid", "email", "profile"],
      approvalFlag: null,
      clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
      clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Google identity (your Google account id).",
        "See your Google email address and basic profile.",
      ],
    },
    {
      id: "youtube",
      name: "YouTube",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
      ],
      approvalFlag: "YOUTUBE_OAUTH_ENABLED",
      clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
      clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Google identity (your Google account id).",
        "See your Google email address and basic profile.",
        "Read your YouTube channel details.",
        "Upload videos to your YouTube channel — only requested when IFund's YouTube upload approval is on; otherwise this permission is not asked for.",
      ],
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      scopes: ["openid", "profile", "email", "w_member_social"],
      approvalFlag: "LINKEDIN_OIDC_ENABLED",
      clientIdEnv: "LINKEDIN_OAUTH_CLIENT_ID",
      clientSecretEnv: "LINKEDIN_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your LinkedIn identity (your LinkedIn account id).",
        "See your LinkedIn profile and email address.",
        "Post on your behalf on LinkedIn — only requested when IFund's LinkedIn posting approval is on; otherwise this permission is not asked for.",
      ],
    },
    {
      id: "discord",
      name: "Discord",
      scopes: ["identify"],
      approvalFlag: "DISCORD_OAUTH_ENABLED",
      clientIdEnv: "DISCORD_OAUTH_CLIENT_ID",
      clientSecretEnv: "DISCORD_OAUTH_CLIENT_SECRET",
      requests: ["Confirm your Discord identity (your Discord account id)."],
    },
    {
      id: "github",
      name: "GitHub",
      scopes: ["read:user"],
      approvalFlag: "GITHUB_OAUTH_ENABLED",
      clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
      clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
      requests: ["Read your public GitHub profile details."],
    },
    {
      id: "twitch",
      name: "Twitch",
      scopes: ["user:read:email"],
      approvalFlag: "TWITCH_OAUTH_ENABLED",
      clientIdEnv: "TWITCH_OAUTH_CLIENT_ID",
      clientSecretEnv: "TWITCH_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Twitch identity (your Twitch account id).",
        "See the email address on your Twitch account.",
      ],
    },
    {
      id: "slack",
      name: "Slack",
      scopes: ["openid", "profile"],
      approvalFlag: "SLACK_OAUTH_ENABLED",
      clientIdEnv: "SLACK_OAUTH_CLIENT_ID",
      clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Slack identity (your Slack account id).",
        "See your basic Slack profile.",
      ],
    },
    {
      id: "patreon",
      name: "Patreon",
      scopes: ["identity"],
      approvalFlag: "PATREON_OAUTH_ENABLED",
      clientIdEnv: "PATREON_OAUTH_CLIENT_ID",
      clientSecretEnv: "PATREON_OAUTH_CLIENT_SECRET",
      requests: ["Confirm your Patreon identity (your Patreon account id)."],
    },
    {
      id: "eventbrite",
      name: "Eventbrite",
      scopes: [],
      approvalFlag: "EVENTBRITE_OAUTH_ENABLED",
      clientIdEnv: "EVENTBRITE_OAUTH_CLIENT_ID",
      clientSecretEnv: "EVENTBRITE_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Eventbrite identity (your Eventbrite account id).",
        "No extra permissions are requested for Eventbrite.",
      ],
    },
    {
      id: "pinterest",
      name: "Pinterest",
      scopes: ["user_accounts:read"],
      approvalFlag: "PINTEREST_TRIAL_APPROVED",
      clientIdEnv: "PINTEREST_OAUTH_CLIENT_ID",
      clientSecretEnv: "PINTEREST_OAUTH_CLIENT_SECRET",
      requests: ["Read your Pinterest account details."],
    },
    {
      id: "reddit",
      name: "Reddit",
      scopes: ["identity"],
      approvalFlag: "REDDIT_COMMERCIAL_APPROVED",
      clientIdEnv: "REDDIT_OAUTH_CLIENT_ID",
      clientSecretEnv: "REDDIT_OAUTH_CLIENT_SECRET",
      requests: ["Confirm your Reddit identity (your Reddit account id)."],
    },
    {
      id: "x",
      name: "X (Twitter)",
      scopes: ["users.read", "tweet.read", "offline.access"],
      approvalFlag: "X_OAUTH_USER_ENABLED",
      clientIdEnv: "X_OAUTH_CLIENT_ID",
      clientSecretEnv: "X_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your X identity (your X account id, name, and username).",
        "Read your posts on X.",
        "Keep this connection working without asking you to sign in every time.",
        "Post on your behalf on X — only requested when IFund's X publishing approval is on; otherwise this permission is not asked for.",
      ],
    },
    {
      id: "tiktok",
      name: "TikTok",
      scopes: ["user.info.basic", "video.list", "video.upload"],
      approvalFlag: "TIKTOK_LOGIN_ENABLED",
      clientIdEnv: "TIKTOK_CLIENT_KEY",
      clientSecretEnv: "TIKTOK_CLIENT_SECRET",
      requests: [
        "Confirm your TikTok identity (your TikTok account id).",
        "See your basic TikTok profile.",
        "List your TikTok videos.",
        "Upload videos to your TikTok account — only requested when IFund's TikTok upload approval is on; otherwise this permission is not asked for.",
      ],
    },
    {
      id: "facebook_pages",
      name: "Facebook Pages",
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
      ],
      approvalFlag: "META_PAGES_APPROVED",
      clientIdEnv: "META_OAUTH_CLIENT_ID",
      clientSecretEnv: "META_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Facebook identity (your Facebook account id).",
        "List the Facebook Pages you manage.",
        "Read engagement on your Pages.",
        "Manage posts on your Pages — this is the permission Facebook asks you to approve; IFund still will not post anything without your separate approval first.",
      ],
    },
    {
      id: "instagram",
      name: "Instagram",
      scopes: [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_business_manage_comments",
        "instagram_business_manage_messages",
        "instagram_business_manage_insights",
      ],
      approvalFlag: "INSTAGRAM_BUSINESS_APPROVED",
      clientIdEnv: "INSTAGRAM_OAUTH_CLIENT_ID",
      clientSecretEnv: "INSTAGRAM_OAUTH_CLIENT_SECRET",
      requests: [
        "Confirm your Instagram business account identity.",
        "Read your basic Instagram business profile.",
        "Manage comments and messages on your Instagram business account.",
        "Read insights for your Instagram business account.",
        "Publish content to your Instagram business account — this is a permission Instagram asks you to approve; IFund still will not publish anything without your separate approval first.",
      ],
    },
  ].map((row) => Object.freeze(row)),
);

export const OAUTH_CONSENT_IDS = Object.freeze(
  OAUTH_CONSENT_PROVIDERS.map((row) => row.id),
);

export function oauthConsent(providerId) {
  return OAUTH_CONSENT_PROVIDERS.find((row) => row.id === providerId) || null;
}
