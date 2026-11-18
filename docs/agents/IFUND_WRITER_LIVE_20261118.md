# IFund Writer reboot and IFund Live foundation — 2026-11-18

## Sources and current implementation
- Canonical web app: `interplanetarysister/InterplanetaryFund` `apps/web`. This branch is based on `feature/route-completion-20261113`; not production.
- Historical reference, **read-only**: `interplanetarysister/interplanetary-fund2`.
- Reference Reporter: `base44/functions/runReporterDiary/entry.ts` and `base44/workflows/IFund Reporter Daily Diary.jsonc`. Historical schedule 17:30 America/Los_Angeles; produces official `BlogEntry` newsletters with deduplication, but direct publishing and service-role execution need migration review.
- Reference research: `base44/workflows/Weekly Writing Psychology & Social Trends Training.jsonc` and `latestWritingGuidance`. Scheduled daily retry with weekly deduplication.
- Reference official social: `base44/functions/runOfficialSocialPromotion/entry.ts`, `base44/workflows/IFund Official Social Editor.jsonc`. Historical four-hour cadence, pending moderation, no unsupported provider success claims.
- Legacy `runSocialAutopilot` is user campaign marketing with separate campaign-owner consent and connection rules. **Do not merge this with official iFund platform marketing**.

## Editorial reboot (source implementation)
- `apps/web/src/lib/editorialWriter.mjs` provides research-first verification, 14-day source freshness checks, verified IFund release reference checks, channel-specific prompts (news, guide/blog, social/video), duplication checks, and citation alignment.
- `apps/web/tests/editorial-writer.test.mjs` checks positive and negative input and approval boundaries. Source commits alone do not establish executed test results.
- News: distinguish shipped vs preview vs proposals; cite dated public evidence. No invented financial claims.
- Blogs: empathetic, upbeat, accessible, practical fundraising guidance (goal, story, image, budget, updates, ethical calls to action).
- Social: original image concept and 15–30 second short-video storyboard per item; require rights, captions, accessible description, and destination-specific approval. Concept is **not** a generated or uploaded media asset.
- Every item stays a **draft** after text generation. Publishing requires editor review and server-side official-role verification; provider posting requires separate scoped consent, capability verification, idempotency and receipt confirmation.
- No fabricated testimonials or paid ads disguised as editorial. Be positive about IFund when mentioned without misrepresenting incomplete features.

## Current public page connections
- Existing routes: `/news`, `/blogs`, `/blogs/:id`, `/publications/:id`, `/social`, `/shorts`.
- Added: `/live` media hub; `/fundraising-tips` accessible actionable user guide. Source-linked navigation added in Layout and Blogs.
- The route acceptance manifest includes the new pages but leaves them `not_verified` pending build, browser/auth/backend/mobile acceptance. Do not bypass the fail-closed release gate.

## What "iFund Live" meant in historical source
The former repo used "live" primarily for production campaign donations and account/provider status. There was **no verified native livestream encoder/player/broadcast server or event ticketing infrastructure** in the examined source. Relevant partial capability:
- `src/components/media/MediaUpload.jsx` accepts image/video;
- `src/components/campaigns/UpdatesSection.jsx` attaches campaign video updates;
- `src/components/social/SocialFeed.jsx` renders near-real-time post updates;
- `base44/shared/aiConnectionScope.ts` enumerates `publish_video` and `livestream` as potential provider capabilities, **not** proof of a live adapter;
- `base44/functions/generateDistributionContent/entry.ts` includes TikTok/video caption guidance;
- `src/components/globe/LiveCampaignGrid.jsx` uses "live" in the sense of published campaign data.
- `docs/LIVE_FUNDRAISING_MODE.md` concerns the `public_campaign_fundraising` payments flag, not live video.

## IFund Live delivery phases and gates
1. Discovery/hub: honest navigation to existing shorts, editorial, social and campaigns. Added as static public page.
2. Broadcast model: owner-scoped live session table with RLS, status `scheduled|live|ended|cancelled`, verified start/end, topic, campaign relation, approved hosts, moderation roles and recordings.
3. Provider integration: choose authorized streaming provider, verify webhook signatures, short-lived publishing/playback tokens, quota and account costs, and consent to record; no unrestricted OBS keys or published secrets.
4. Viewer UX: accessible video playback, captions/transcripts, safe reporting, anti-abuse/moderation, event reminders, recording retention and privacy.
5. Fundraising: redirect only to verified campaign checkout, distinguish partner-hosted payments, never equate views/hearts/chat with donations.
6. Release: tests for RLS/cross-account isolation, input and webhook spoofing, stream expiry, player fallback, mobile data conditions, accessibility, moderation and recording revocation before preview. Production promotion requires owner-approved provider, cost, and release evidence.

## Not yet operational
- No scheduled or independently executed canonical worker is delivering researched articles, uploading original media, or publishing news/social.
- No verified provider-backed streaming session, moderation backend, video generation workflow, captioning or licensing pipeline.
- Source-level route resolution does **not** prove live browser/server correctness.
- No build, GitHub Actions, production deployment, provider configuration, DNS or financial switch was changed by this branch.


## Verified data checkpoint — November 18, 2026
- Connected Supabase production project `ssibsfmtodgximseeqsv` contained one active official blog with a confirmed owner.
- The latest official Reporter issue located was dated 2026-10-25 Pacific, published 2026-10-26 UTC. This does not establish that its scheduled workflow remains active.
- Two **unpublished official blog drafts** were saved directly through an owner-matched, duplicate-checked database insertion:
  - `325b81f7-cfd9-49a2-a27a-81d3d6a808ba` — Six small changes that can make your fundraiser easier to support (article).
  - `d4ebcd52-9b9c-4c1f-abd4-1ba7789923a7` — A clearer path from your fundraising story to the people who care (newsletter).
- Both database rows have `status='draft'`, `featured=false`, and `published_at=null`; no external distribution or publication was initiated.
- Platform social copy and 15–30 second original-video scripts remain versioned source drafts at `content/editorial/drafts/2026-11-18-ifund-writer-restart.md`. No actual image, video, provider post or livestream was created.
- Attempting to start a daily editorial automation returned a five-active-task account limit. Existing engineering automations were not replaced, so editorial scheduling **remains inactive**.
- Source-only static route changes are not a passing browser/build or live-service test. Keep the independent route acceptance gate closed.
- Future live broadcasts must be budgeted before enabling metered video infrastructure; free-website hosting quotas do not imply free video encoding and delivery.

## Explicit release acceptance
Do not claim writer reboot, autonomous research, daily publishing or livestream operations fully live until all of: independently fetched and dated sources before each generation; provider-backed inference; server-side editorial review and publishing authorization; durable idempotent scheduler; verified media assets and licenses; authenticated preview + mobile route tests; signed streaming provider lifecycle (for Live) and approved usage budget; and documented production release evidence.


## iFund Live event scheduling implementation — November 18 continuation
Source commit series on `feature/ifund-writer-live-20261118` adds:
- `supabase/migrations/20261118171000_ifund_live_events_foundation.sql`: owner-bound event metadata, public event visibility, guarded status transitions, campaign owner association, confirmed-email creator check, deny-by-default RLS, no member deletion, no privileged service-role keys.
- `apps/web/src/api/liveEvents.js`: verified owner and session guard, event validation, create-private-first flow, status compare-and-swap, public discovery fail-closed when the table is unavailable.
- `apps/web/src/pages/ManageLiveEvents.jsx`: new member-only `/live/manage` event drafts, upcoming announcements, edits, cancellations and recording-consent acknowledgement.
- `apps/web/src/pages/IFundLive.jsx`: public list of upcoming events and verified live metadata, while explicitly withholding playback and active-stream claims until provider integration.
- `apps/web/tests/ifund-live-events.test.mjs`: owner/visibility/validation SQL source contract checks; NOT yet executed with Node/Postgres browser.
- `apps/web/ci/route-acceptance.json`: `/live/manage` source status remains `not_verified`.
- Verified GitHub source cross-check confirms the member-only route, guarded event API and SQL RLS snippets. This is not an RLS runtime test.

**Release blockers:** SQL migration has **not** been applied. Site has no new event table in production, so public listing fails closed. No streamed video provider, signed webhooks, stream-key secret store, recording upload, host moderation, transcripts or playback. Real live state must be advanced only after verified provider webhook evidence through a privileged backend. Do not turn on broadcast provider (Cloudflare Stream is billed by delivered minutes, including WebRTC since October 15, 2026) without budget approval, rate/usage controls and acceptance.

**Next verification:** run the checked-in Node tests; on an isolated Supabase/PGlite database run anonymous vs confirmed/unconfirmed creator, cross-owner, other-campaign, insert-as-live, scheduled visibility, replay and concurrent edit tests; check privileges, anon reading, owner session changes and responsive /live/manage user journeys at 320px/390px. Only after passing these tests apply a reviewed migration and preview the app under the existing full-site gate. The source-only checks are not enough to remove release hold.
