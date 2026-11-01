# IFund Cloudflare workforce — preservation stage (inactive)

This folder is a byte-exact, reproducible snapshot of ten Base44 agent JSONC definitions and 26 local skill/guide files, including descriptions, instructions, tool allowlists, role assignments, selected remote skill identifiers, and memory **configuration**. It is **not** a Cloudflare Worker runtime and is not imported by `host/gateway/worker.js`.

Run `node scripts/stage-cloudflare-workforce.mjs` to refresh from canonical source and `node scripts/verify-cloudflare-workforce-stage.mjs` to verify exact source parity. No secrets, user conversations, personal agent memories, remote skill bodies, OAuth tokens, or runtime grants are copied. The remote skills inventory and live memory export require separate authorized discovery and access checks.

Before activation: reconcile remote managed skill IDs and content; migrate memory with identity-scoped encryption, deletion and retention; implement server-verified authentication/entitlements and per-tool permissions; map each tool to an independently tested Cloudflare/Supabase backend; test delegated actions, OBO consent, scheduler idempotency, failure recovery and auditing; run parallel read-only shadow checks and controlled rollback. Never dual-execute financial or publishing writes. Do not disable Base44 agents or change DNS until verified.

Known pre-existing regression: `scripts/verify-ifund-skill-migration.mjs` fails against its older fixture for chief_of_staff tool additions (`routeAgentTask`, `getVerifiedIFundIntegrationContext`, `discoverConnectionMethods`). This staging did not change source permissions or repair the fixture.
