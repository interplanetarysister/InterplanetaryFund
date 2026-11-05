# Managed Connections: scoped preview increment

Source: `interplanetary-fund2@fb2afc64d72194c51c552bc7b5260a479d7566eb`, Managed Connections agent, authority contract and provider catalog. Implementation integrates Communications PR #220 and the separately reviewed workforce PR #212. Production promotion remains held under the latest owner instruction.

## Demonstrable behavior

`/connections` and `/agents/connections` share one member workspace and preview Worker. All 43 source provider identities and 42 exact source logos are available. Logo hashes/provenance are in `inventory/provider-assets.json`; neither a logo nor the source's OAuth hint establishes working access.

The owner can explicitly allow IFund connection help for one provider and either one currently owned campaign or their account. Permission records the exact policy version, lasts 30 days, excludes publishing/payments/accepting terms, and can be revoked. New permissions and requests require a backend-verified Outreach/Nonprofit or higher entitlement (source minimum level 2). Reading, cancelling and revoking remain available after plan expiry. Confirmed active identity and current legal acceptance remain mandatory.

Requests reuse canonical `ifund_agent_delegation`; help permission reuses `ifund_authorization_grant`. Private metadata preserves exact scope, versions and immutable owner operation receipts. No duplicate campaign, identity, connection or financial store is created. Requests are truthful `waiting_external/setup_required`: no registered provider app or executor is available in this increment. A saved request does not create an account, connect a provider or run a browser. No AI inference occurs in this increment.

Up to 50 explicitly selected requests or permissions can be reviewed and cancelled/revoked atomically. One foreign, stale or duplicate item rejects the whole operation. Revocation cancels pending IFund work under that permission; it does not claim to revoke permission at a provider. Replay returns the original receipt; the UI reloads canonical state. Interrupted replies retry the same operation ID and payload. Campaign deletion revokes/cancels related work while preserving the original campaign UUID; it cannot turn campaign permission into account-wide access.

Saved `ifund_connections` rows are conservative records. Even a row labelled connected with a `verified_at` timestamp is displayed as requiring current verification. No capability or financial authority is inferred. No credential/token field, provider email, raw secret or admin operation is accepted by member action APIs.

## Shared service assets and tool boundaries

All ten source role declarations are preserved by hash in the server-only service contracts and skill manifest. Declared tools are not automatically executable. The tool registry requires fresh backend owner eligibility, explicit read/write classification, current tested/free adapter evidence, admin checks and verified receipts for writes. Managed provider actions require current versioned help permission. Sending and financial reconciliation additionally require exact protected owner approval. Incident/builder approval and release modes remain in protected owner review, outside model tools. The twelve opaque remote skill IDs have not been reconciled; source references are not installed runtime skills.

The workforce integration preserves the existing canonical queue, private preview/production executor separation and immutable implementation identities. Production procurement stays disabled; the earlier automatic approval rejection and required real-member receipt are preserved. Strategy, Growth, Communications and other specialist executors are not silently declared connected to procurement by this merge.

## Verification and live evidence

- Independent Reviewer: 11 executable PostgreSQL cases, 8 Worker cases, 11 registry cases pass. Campaign-deletion regression and same-route provider navigation were addressed.
- Local catalog: 3 cases verify all source identities, exact logo checksums and no authority from hints.
- Local browser: 10 checks cover member guard, 390px layout/assets, explicit scoped consent, immutable interrupted-request retry, reviewed cancellation, stale revocation, same-route provider reset, expired-plan revocation and account switching. Mock identities/receipts only.
- Shared-workforce merge regression: Story database, workforce database/procurement/runtime and catalog test files pass. The merged publishing/Auth baseline at workforce head `173a921533e9d3fcd5822e35f9c9a53b81521b17` is preserved. Independent frontend29 test files, fresh build,10 Managed browser checks and14 Story/Auth/campaign browser checks pass. The final full44-file backend suite passes. The committed Story/Auth and Managed browser fixtures were updated to reproduce all24 audited checks and independently rerun successfully. Permanent gateway aliases now forward all four existing specialist Workers with exact payload/query/auth preservation; unsupported/private routes stay excluded.
- Before installation, hosted catalog confirmed no existing connection-runtime schema/migration and no browser write grants on canonical authorization/delegation tables. Existing Security Advisor findings were retained as baseline; this increment does not broaden raw table grants.

NOT TESTED: actual signed-in hosted member request, provider registration/OAuth/token vault/refresh/revocation, actual account creation, real capability receipts, native browser execution, Managed conversational AI runtime, historical memory, specialist execution and all scheduled workflow parity. These are completion gates, not capabilities of the request form. No supporter delivery, production deployment, financial activation, DNS/mail changes or paid resource was performed.

## Next work within this agent

Implement the actual supervised Managed conversation/tool executor on the shared workforce, reconcile each source skill, then install verified provider adapters with protected credential storage and exact registered callback/scopes. Verify official provider policy and current no-charge availability before enabling each adapter. Login/MFA/CAPTCHA/terms remain owner steps. Missing IFund registration must continue to say IFund is setting up the connection; members must not be asked to create developer apps or paste secrets into chat.

Do not mark this agent complete or begin the next specialist as a completed-agent handoff until these gates are satisfied or a specific external blocker is recorded for owner resolution. Story's actual IFund-style campaign image generation/storage/review also remains required before the final production gate.

Hosted installation: `20261105115633_ifund_managed_connections_contracts.sql`, exact 24,303 bytes, MD5 `65c5f4d1e0078fdcc39995c62e9df8a7`. Initial control disabled; 43 providers; four authenticated-only security-invoker wrappers; zero direct browser table grants. The exact applied source is immutable.

Pre/post-install Security Advisor names are unchanged: intentional private-schema RLS-without-browser-policies; existing anon/authenticated definer notices; existing leaked-password-protection setting. No raw table access was added. See [Supabase Advisor guidance](https://supabase.com/docs/guides/database/database-linter) for baseline notices.
