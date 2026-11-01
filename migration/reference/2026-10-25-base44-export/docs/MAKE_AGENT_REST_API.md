# External AI agent REST API (Make integration)

This route is intended for Make HTTP modules, **not** the MCP OAuth connection.

## Generate credentials
After this branch is merged and both Base44 and Cloudflare deployed, sign in as the approved super-admin and open `https://interplanetaryfund.com/admin/agent-api`. Enter an agent label, generate a key, and copy it immediately. Keys are shown once and stored as hashes; revoke and regenerate them from the same page.

## Make HTTP module
- Method: `GET`
- URL: `https://interplanetaryfund.com/api/v1/agent/campaigns`
- Header `Authorization: Bearer <your-generated-agent-key>`
- Header `Accept: application/json`
- Body: none
- Expect `campaigns` array and `publishing_enabled: false`.

This route is a **read-only campaign feed**, not a webhook or social publishing API. Make can schedule requests to this endpoint. For event-driven campaigns, use a separately authenticated outbound webhook sender and verify user consent before implementing it. Do not claim real-time event delivery based on this feed.

## Server prerequisites
- Deploy the `ExternalAgentApiKey` entity schema and the `manageExternalAgentKeys` and `externalAgentCampaigns` server functions to the authoritative Base44 app.
- Deploy `host/gateway/worker.js` and route `/api/v1/agent/campaigns` to the Cloudflare Worker.
- Set protected Worker variable `IFUND_AGENT_CAMPAIGNS_URL` to the **exact deployed** Base44 HTTPS function URL for `externalAgentCampaigns`. Do not invent a URL or place a secret in frontend environment variables.
- Preserve existing MCP and admin gateway routes.
- Confirm `401` for missing/revoked keys, `200` only for a valid key, and `503` when backend configuration is absent.
- Inspect consent and campaign privacy before releasing the feed. A campaign being active is not sufficient consent to reuse it externally.
- Test key creation, listing, revocation, and unauthorized page access on the deployed site. Check CORS is not needed when Make's cloud HTTP module makes requests.

## Boundaries
The key is scoped to `campaigns:read`; it does not authorize posting, messaging, donor records, payment records, or development-agent calls. Make must separately authorize each social platform and must not assume campaign content can be republished without the campaign owner's permission.
