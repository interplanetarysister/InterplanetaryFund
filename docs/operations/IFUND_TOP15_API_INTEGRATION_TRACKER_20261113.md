# Free API Connections: source-stage checkpoint (2026-11-13)
The 15-platform research is an eligibility list, not proof of provider approvals. These changes extend PR #286; keep the no-preview/no-production release gate until full route acceptance.

| Platform | Implementation | Developer access / next gate |
| --- | --- | --- |
| Facebook | existing OAuth | Meta App Review, Page scopes |
| YouTube | existing OAuth | Google OAuth project, upload scope verification |
| Instagram | existing OAuth | Professional account and Meta App Review |
| LinkedIn | existing OAuth | self-service identity; request advanced posting where needed |
| TikTok | existing OAuth | app review and content-posting audit |
| Reddit | added identity OAuth, disabled by default | explicit Reddit commercial Data API authorization and agreement |
| Discord | added identity OAuth | developer app registration and flag |
| Telegram | public link, tile (no secure account claim) | BotFather bot and user opt-in; separate Bot/OIDC implementation |
| Pinterest | added identity OAuth, disabled by default | Pinterest Trial or Standard API approval |
| Twitch | added identity OAuth | Twitch developer app |
| Slack | added identity OIDC | Slack app and permitted redirect |
| GitHub | added read:user OAuth | GitHub developer app registration; no repo writes |
| Patreon | added identity OAuth v2 | register API v2 client |
| Eventbrite | added identity OAuth | app client ID/secret for user authorization |
| Bluesky | public profile link only | AT Protocol OAuth SDK with DPoP, PAR, PKCE and token rotation |

Each new developer registration needs a client ID/secret stored in Cloudflare-only bindings. Pair with explicit <PROVIDER>_OAUTH_ENABLED flags, or REDDIT_COMMERCIAL_APPROVED / PINTEREST_TRIAL_APPROVED. Web callbacks use https://interplanetaryfund.com/oauth/callback/<provider>; preview apps need separate registered callbacks.
No requested posting scope is inferred from identity; agents may prepare drafts and must obtain distinct user review and verified platform write scopes to publish. No passwords, scraper logins, silent third-party sign-ups, or unapproved autoposting.
No claim of live account authorization, submitted provider application, provider approval or end-to-end browser certification until verified.
