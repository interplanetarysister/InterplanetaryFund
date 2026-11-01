# Integration Registry Safety Contract

This runbook records the production truth boundary for Interplanetary Fund integrations.

## Current Base44-native rules

- Configuration is not provider verification. Creating a registry row starts it as `DISCONNECTED`.
- Reauthorization is a request to verify again. It must not set `ACTIVE` by itself.
- `ACTIVE` requires provider-backed evidence obtained during the current verification path.
- Unknown or malformed status values render as `Unknown`, never as `Active`.
- Provider/server exception text is retained only in controlled server diagnostics; user-facing admin and owner notifications use stable safe copy.
- Concurrent admin actions are single-flight and time-bounded.
- `last_successful_verification` advances only when a provider-backed check succeeds.
- Historical Convex rows are retained as migration evidence but are not made active in the Base44-authoritative runtime.
- Optional or unsupported integrations must not be represented as working merely because a token/reference exists.
- Owner-supplied provider hosts (for example Mastodon instances) must not be fetched server-side until the runtime has a DNS-pinned, redirect-safe outbound transport; until then, verification fails closed rather than risking SSRF or claiming unsupported availability.
- Service-scoped feed mirroring requires the exact owner, canonical OBO authorization, a verified connection, and automation enabled. Shared connector results must never be fanned out across unrelated owners.
- Discord feed mirroring remains disabled until the provider connection can be bound to the exact owner/account. Mastodon feed mirroring remains disabled until safe arbitrary-host transport exists.
- Metered browser observation performs zero external runs until atomic quota reservation and an approved network/URL policy exist.
- Connection-recipe learning is server-owned. Client/admin assertions such as `result=success` are not provider evidence and cannot promote a recipe to `proven`.
- Shared connector token presence proves configuration only. Unknown shared connectors remain unverified until a provider-backed check succeeds.
- External campaign import and refresh are server-discovered from the approved provider page. Client-supplied campaign snapshots are not provider evidence.
- A required IFund campaign goal may be owner-supplied when the provider page does not expose a trustworthy goal, but that field must be labeled `owner_supplied`; never invent a placeholder goal or attribute it to the provider.
- Editing connection settings must preserve existing owner-reported totals/donor counts when those fields are omitted; configuration edits must not silently zero financial observations.
- Link-based fundraising connections become verified only after an approved provider-domain page check succeeds. The page check verifies reachability, not monetary totals; totals remain `owner_reported` unless a provider-backed transaction path proves them.
- Fundraising capability flags describe IFund's currently implemented Base44 behavior, not theoretical provider features. Stored/admin capability rows may disable a runtime feature but cannot enable one that the build does not implement.
- Approved public-page campaign metadata import/sync may be marked `in_progress` when the Base44 adapter exists but live provider testing or payout capability remains incomplete. `in_progress` never implies balance-read or payout support.
- `Collect & Withdraw` may offer IFund-initiated transfer only when the current build has both a verified `api_transfer` capability and a provider-specific `transfer:` adapter. Provider-managed automatic/direct payout models are not executable IFund transfer routes.

## Future Convex/Vercel restoration knowledge

If Convex or Vercel is restored later, keep the interface contract above. A restored adapter may supply provider verification, scheduling, or server transport, but must return explicit evidence rather than allowing configuration state to imply production readiness. Preserve owner scoping, redaction, OBO authorization, audit logging, and the canonical 3% withdrawal-fee boundary.

Do not restore historical infrastructure by changing UI truth semantics. Provider availability, settlement state, ownership, credentials, and deployment health remain unknown until verified by the authoritative runtime/provider.