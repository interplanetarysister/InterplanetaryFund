# Campaign creation writing service

Baseline: main `721a7902ef0f6203273863ed9967b4f614694155`. This is the next
bounded component after the verified publishing and permanent-gateway releases.
The nine service positions, private builder, membership rules and financial
behavior are unchanged.

## Existing behavior and evidence

The creator called canonical Supabase `ifund-campaign-draft-preview`, active
version 2, bundle hash
`b0c7c22b2ee2d70f81961cacd349c17a6acd780fce169d59246fab0ea48e4120`.
The actual deployed function was inspected, not inferred from its name: it
constructs deterministic templates, returns `ai_inference:false`, and calls no
model/provider. Its source is preserved in
[the reference snapshot](../migration/reference/ifund-campaign-draft-preview-v2.ts).
Its CORS list excludes Pages previews. The old function is retained for existing
clients and has not been modified or retired.

## Implemented contract

- The canonical creator calls the same-origin permanent service endpoint
  `/api/services/story_agent/campaign-preview`. Cloudflare determines delivery;
  the browser sends facts and a retry reference, never model/provider choices.
- The server reuses Story's authenticated subscription read, which checks the
  current confirmed identity and active account. Failed/unknown access never
  becomes a successful outline. Existing eligible members use the existing
  Story execution, including its current agreement, entitlement, ownership,
  quota, lease and receipt checks. No access rule or subscription is changed.
- Other verified accounts retain a basic outline ported from the existing free
  helper. It requires no inference, external API, new resource or database write.
  Names and supplied facts remain intact; five title candidates/two summaries
  fit campaign field limits. The UI explicitly labels this as a basic outline.
- Eligible native requests never silently become basic outlines after a quota,
  permission or provider failure. Queued 202 responses contain no fabricated
  completed copy. Input and previous suggestions remain available. Retry UUIDs
  stay stable until success or a verified new-request-required response.
- Native output requires a confirmed stored suggestion receipt and the existing
  full/section validator. A section rewrite preserves every returned paragraph
  and leaves other sections unchanged. A basic outline is never represented as
  a section rewrite or a generated image.
- Suggestion requests never write the campaign. Owners choose which ideas to
  apply and explicitly save/publish through the existing owner API.
- The writing brief and starting choice survive guest→first-sign-in handoff
  under the existing scoped browser record. Account changes clear form/assistant
  state; late replies are checked against the current account. Credentials and
  request references are not persisted in that record.
- Drafts with an unset goal display a blank goal after reload, so they remain
  savable before the goal is chosen. No stored goal or financial record changes.

## Verification and release ledger

- Focused source checks: 10 server-service cases, eight client-transport cases,
  five scoped-storage cases; all pass. Reviewer 2 independently ran all 23 cases
  and found no blocking issue.
- Canonical web: all 28 test files and production build pass. Root: all 34 test
  files and build pass. No package or lockfile change.
- Chromium at 390×844, local app with intercepted Supabase/native transport:
  15 scenarios pass, including manual and assisted creation→apply→publish,
  repeat saving of an incomplete draft, truthful basic outline mode, duplicate
  click protection, stable queued resume, complete section replacement,
  preserved work on failure, sign-in handoff and late cross-account replies.
  These are UI/transport checks, not a real signed-in provider receipt.
- No new migration, model/provider, paid dependency, inference test, storage
  resource, billing activation or external publication was introduced.
- PR [#222](https://github.com/interplanetarysister/InterplanetaryFund/pull/222)
  merged reviewed head `f866164a23c111cf92ad561ac2c3e4d6efb31d1f` as main
  `15b987f165217eabca21d1abba12a93018d06a0e`; the two trees match exactly.
  Frontend CI `42024101322`, release-candidate CI `42024101202` and main CI
  `42025153722` passed.
- Preview `d6757727-21ec-47b7-8e61-7bdb40aeff4a` deployed reviewed head
  `f866164` successfully. Independent Auditor 3 passed 12 actual HTTPS
  authorization checks, deployed artifact inspection and public/mobile
  rendering with five choices, 11 categories and scoped guest restoration.
- Production release `da71bc17-318c-4bd9-8125-0dbee1375691` deployed main
  `15b987f` successfully at `2026-11-05T12:13:41.038908Z`. Its inspected
  main and creator artifacts match the reviewed preview byte for byte.
- Follow-up inspection on November 5 Pacific / November 6 UTC found a newer
  production deployment, `8296ae39-8a48-4b9a-a139-cd3dcec661b1`, source
  `ed39a2e6cc6273c4bd7660dd3058299fadd0cad5`. It contains this release.
  Subsequent commits change the owner-provided platform-support footer in
  three other files; this increment did not modify those financial/UI changes.
  Actual live-domain authorization checks and writing/publishing client
  contract markers passed again. No campaign or payment action was executed.
- Independent current-production review passed all 12 authorization checks
  and actual-response mobile rendering with no script errors, failed reads or
  overflow. The renderer used TLS-verified proxy responses; direct Chromium
  networking remains unverified because of the environment's certificate trust
  limitation. See the [durable auditor record](CAMPAIGN_WRITING_DEPLOYMENT_AUDIT_2026-11-06.md).
- Actual signed-in hosted generation/publication and recovery remain
  **NOT TESTED** by the builder/auditor. Production workforce procurement
  remains disabled; no negative authorization check substitutes for a real
  member execution receipt.

## Current deployment and control reconciliation

The November 6 UTC read differs from the historical November 5 preview state:
both database procurement controls are now false, with zero assignments.
The production Story workforce flag is still absent; Pages still binds only
the original production Story Worker and uses canonical Supabase. The account's
Free-plan attestation expires November 11 at `05:56:47Z`.

Automatic Pages production deployment is now true, as observed after the newer
footer releases. This component did not change that setting or either
procurement control, and did not restore the older preview enablement.
Reconcile current preview controls before resuming the separately pending
authenticated procurement test. Do not treat an older preview URL or document
as proof that procurement is currently enabled.

## Wider migration limits

The permanent gateway compatibility release is deployed as Pages `92822be7` and
Story Worker version `cfaef544-560d-40da-8292-12d0ee142c63`, source `721a790`.
Its production/public route audit passed, with original bindings inherited,
workforce flag absent and database production procurement false. This writing
component does not enable that control or claim full specialist, collaboration,
shared-knowledge, outcome-learning or workflow/connector parity.
