# Auditor 3 — real preview writing receipt

Recorded November 8, 2026 (Los Angeles), `2026-11-08T18:57:18Z`. **PASS within the receipt-linkage, source/configuration and negative-authorization scope below.**

This audit used read-only SQL and Cloudflare metadata plus unauthenticated/invalid-token HTTPS probes. No model inference, authenticated task request, campaign save/publication, payment action, key/flag change or deployment was performed. No raw campaign copy, owner identifiers, email addresses or secret credential values were retrieved or returned.

## Genuine preview generation — PASS

The user's report of generated brief/story is corroborated by one actual successful preview assignment and its canonical stored receipt.

- Position `story_agent`; implementation `cloudflare_story_llama33_v1`, revision `1`; provider `cloudflare`, adapter `workers_ai`, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Assignment at `2026-11-08T18:14:44.735607Z`, dispatch/start at `18:14:44.870168Z`, completion at `18:14:57.895838Z`; ordered timestamps and recorded assignment lease.
- Canonical job `story_agent_v1` succeeded under task contract `story.draft.v1`; assignment/job environment and owner match. Completion released the job lease.
- Immutable implementation snapshot matches the assignment ID/revision; permanent service contract matches its registry. Execution events are `workforce_assigned` and `workforce_succeeded`.
- The canonical job links its draft receipt, and the draft owner matches the assignment owner. An owner-scoped Story activity receipt exists.
- Stored source is `ifund_story_v1`, source agent `story_agent`, kind `campaign_changes`, status `draft`.
- Shape: five titles, two summaries, 1,206-character story and 419-character image direction. Titles range from 32–48 characters; the longest summary is 299 characters. These fit the campaign field limits. Actual text was not selected.
- Implementation performance now records one success and zero failures. The receipt owner remains confirmed, active, not pending deletion and explicitly consented to the current agreement.

This is trusted backend evidence of native Cloudflare preview execution, corroborating the real user's report. It is not an audit-created fixture or a rollback-only SQL claim. Provider-reported token/neuron telemetry was not collected, and no fundraising outcome is inferred. This closes the previously missing real preview drafting receipt; production activation remains a separate operation requiring its own deployment/runtime verification.

## Current separation and cost controls — PASS

- Shared Story switch **false**, production workforce procurement **false**, preview workforce procurement **true**. No switch was changed by this auditor.
- Separate configured executor digests are present. The preview helper is not directly executable by `anon` or `authenticated`; `require_member()` also remains private.
- All five workforce registry/control/capacity/assignment tables have RLS enabled and deny browser-role direct SELECT.
- Migration history contains `20261106031923_ifund_isolated_story_preview_access`. Seven current private gate/claim/start/finish function bodies match the reviewed local source after whitespace normalization; all retain `postgres` ownership, security definer and empty search paths.
- Existing native implementation remains registered, available and tested. Cost metadata: verified, additional cost zero, not a trial, provider hard stop true.
- Existing Free-plan attestation expires `2026-11-11T05:56:47.391613Z`; cost evidence expires `05:53:45.127620Z` and capability evaluation `06:00:47.325890Z` on that date. Nothing was extended.
- Existing caps remain 8,000 scheduled units/day, 1,000 reserved critical units and at most two Story requests/day. The billing plan was not changed or independently re-read; this audit relies on the still-valid owner-confirmed Free-plan attestation.

## Current deployed source and bindings — PASS

- Production Pages `ad7ca314-f09b-45e1-8098-f4aff84ae3bc`, source `a40bb78b0d0d9e2ae24eeaeeaddc69f73a4641e9`, successful. Automatic production deployment is **false**.
- Production Pages binds only `IFUND_STORY_AGENT → ifund-story-agent`. Existing preview Story/Strategy/Growth/Communications/Managed Connections bindings remain separate preview Workers; their presence does not establish other specialist readiness.
- Audited frontend preview `d6757727-21ec-47b7-8e61-7bdb40aeff4a`, source `f866164a23c111cf92ad561ac2c3e4d6efb31d1f`, successful:
  https://d6757727.interplanetaryfund-migration.pages.dev/agents.
- Production Story remains deployment `012e0c2a-2c94-4d09-9021-d82636af4f44`, version `cfaef544-560d-40da-8292-12d0ee142c63` at 100%; no production workforce enablement/environment flag is present.
- Preview Story is deployment `0bf4a84d-dae0-4e90-bf2a-f3f3cc4d0093`, version `a85d1ca6-7834-4f11-bb5d-2905933d0677` at 100%, ETag `c33c6167826d2b97f2d89afb906f0e646d22dc2a39b3d1cf97b144c3b55b0d27`. Its reviewed source marker is `ec7b63634827b0a94ef547caefd611d40a7d8973`; preview workforce execution and preview environment flags remain configured.
- Both Workers retain canonical Supabase URL, native AI binding and secret-text executor-key binding. No secret value was fetched.

## Actual HTTPS negative access checks — PASS

Both https://interplanetaryfund.com and the exact preview URL passed the same 11 expected JSON checks:

| Route | Request/caller | Status |
| --- | --- | --- |
| `/api/services/story_agent/campaign-preview` | GET anonymous | 405 |
| same | POST anonymous / invalid JWT | 401 / 403 |
| `/api/services` | GET anonymous / invalid JWT | 401 / 403 |
| `/api/services/status` | GET anonymous | 401 |
| `/api/services/admin_builder_agent/drafts` | GET anonymous | 404 |
| `/api/services/story_agent/subscription` | GET anonymous | 401 |
| `/api/services/story_agent/drafts` | GET anonymous | 401 |
| `/api/services/story_agent/queued-requests` | GET anonymous | 401 |
| `/api/agents/story/subscription` | GET anonymous | 401 |

Invalid-token POSTs used a synthetic valid envelope but never passed authorization or reached task dispatch.

Deployed creator artifacts still contain the permanent campaign-preview address, explicit Publish campaign, Before you publish and truthful outline/inference markers. Preview main/creator SHA-256 values remain `bbcf18e7f2b266511dd1e66a167b32e06665e6f93bfc208983785553a2ba643a` / `ac8c2f2dc459f4be2ed34b1ee28ea076c58aed6550109948d155d43b9fb74c39`. Production values remain `323587a1e65a6e10e8d70e87a03b5983b60ec77780681fb4f65824f95e092434` / `1f7a43e52c6431abe54a9551b99da91a972123f883eca1ff8abe49958a90996d`.

## Limits and next audit boundary

**NOT TESTED:** live owner publication, the new writing-draft-to-campaign-editor handoff (not yet deployed), two-owner browser isolation, actual queued recovery/reassignment, model replacement, full specialist chat, the administrative Codex builder connection and full collective intelligence operation. The stored private writing draft is not itself a published campaign.

The prior generation gate has real evidence now. Do not use this report as proof of campaign publication or as an automatic production enablement action. Parent builder can reconcile PR #228's already-applied migration filename/history and continue the explicit campaign publishing handoff, then request a bounded audit of its deployed increment.

Safe evidence: `work/member-receipt-20261108-evidence.json`, `work/member-receipt-20261108-preview-http.json`, `work/member-receipt-20261108-production-http.json`. No tracked file was changed.

