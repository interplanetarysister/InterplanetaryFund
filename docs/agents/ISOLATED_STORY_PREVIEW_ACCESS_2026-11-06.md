# Isolated writing preview access

Baseline: main `ad9e709a2e61cbce59c6c84d161f148e61bda605`.
Recorded November 5 Pacific / November 6 UTC.

## Observed blocker

The deployed preview Worker has workforce execution enabled with the private
preview channel. Both workforce database switches were off, and the existing
shared Story service switch was also off. The first guarded restoration
correctly stopped without changing any flag when it detected that Story gate.
Enabling the shared Story switch would also enable production writing; that is
not part of this preview repair.

Live checks confirmed distinct executor digests, unexpired Free-plan and tested
capability evidence, zero assignments and zero reserved units on the current
UTC day. All five workforce tables have RLS and deny browser-role direct reads.
Eleven workforce function bodies match the reviewed migration source.

## Narrow repair

- A private `story_preview_enabled()` helper recognizes only the existing
  key-derived preview channel, enabled preview control and unexpired Free-plan
  evidence. It is not executable by anonymous or authenticated browser roles.
- `require_member()` accepts that private preview path when the shared Story
  switch is off. Confirmed identity, active/non-deleting account, current
  explicit agreement and existing verified entitlement checks remain intact.
  Campaign ownership and all existing task/lease/quota checks still apply.
- Only a Worker configured for both workforce execution and the preview
  environment supplies its private proof to gated Story RPCs. The proof is not
  accepted from the browser or sent to inference. Subscription reads, queued
  request recovery and owner erasure remain independent of that executor key.
- The reviewed operator reconciliation script can enable only preview, after
  checking the installed helper, both production gates, exact tested native
  implementation, independent keys and conservative free-capacity settings.
  No inference or queued task is dispatched by that switch.

No provider, model, permanent position, financial behavior, membership grant,
frontend workflow, storage resource or paid infrastructure is introduced.

## Verification ledger

- 17 actual PGlite database cases pass, including the permanent Cloudflare
  gateway through actual context authorization, procurement, stored receipt and
  replay with both production gates off. Inference and Auth transport in that
  local integration are fixtures, not real provider/member execution.
- Ten Worker runtime cases pass, including missing preview proof and keyless
  recovery/erasure. Existing Story compatibility tests also run against the new
  migration in the database fixture.
- Five function-security checks pass. The new migration explicitly retains
  private helper revocations and empty search paths; the security guard was
  preserved rather than relaxed.
- The rollback-only operator probe passes locally. Its temporary digest/flag/
  expiry changes are fully reverted; it creates no campaign, task, identity,
  entitlement or execution receipt.
- All 34 root test files and the root build pass. The targeted rollback probe
  also passes with PostgREST-compatible claim resolution and the first eligible
  identity deliberately lacking consent. Reviewer 2 independently passed the
  16 core database and ten runtime cases; the final probe/revocation review is
  recorded separately from those earlier results.
- Remote migration, deployed preview audit and live rollback-only verification
  are pending at this source-preparation stage.
- Hosted signed-in generation, queue recovery and provider receipt remain
  **NOT TESTED**. This repair does not enable production writing/procurement or
  declare the full agent network operational.

## Free-capacity evidence

Official [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
was fetched again on November 6 UTC. It confirms 10,000 free neurons/day,
00:00 UTC reset and failed further operations on Free after the limit. The owner
confirmed Workers Free; no plan was changed. Existing 8,000-unit scheduling
ceiling, 1,000-unit reserve and maximum two Story calls/day remain unchanged.
The existing attestations expire November 11; this repair does not extend them.
No inference has been run for this repair.

## Migration provenance and next gate

The migration source is staged for reviewed MCP application. Both current CLI
3.0.0 and latest verified 2.x CLI 2.122.1 attempted to initialize a read-only
home directory, so neither could generate a local migration. No home-directory
override, broader filesystem access or hosted CLI mutation was used. The MCP
assigned migration version will become the authoritative source filename before
merge; no timestamp will be guessed.

After the preview repair and direct checks, obtain a genuine signed-in request
and trusted assignment/provider-backed receipt through the existing private
writing interface. SQL role probes and model fixtures cannot satisfy that gate.
