# Video generation provider: wiring record (2026-11-28)

## Provider decision — from repo evidence, not preference

An exhaustive search of code, docs, env examples, wrangler configs,
migrations, tests and git history found **no external video provider named
anywhere** (no Runway, Pika, Kling, Luma, Replicate, Veo, HeyGen, fal, or
any other). The one AI provider iFund uses for every existing adapter —
text agents, image generation, image improvement, Studio layouts — is
**Cloudflare Workers AI** through the `AI` binding already declared in
`wrangler.jsonc`. The Media Studio said so itself: "image generation above
is live through Cloudflare Workers AI, but there is no video model to
call."

That gap has closed upstream: the Workers AI catalog now carries a
text-to-video model, **`alibaba/wan-3.0`** (Alibaba Wan 3.0), callable
through the same binding with `{ prompt, resolution, ratio, duration }`,
returning `{ state: "Completed", result: { video: "<url>" } }`
(Cloudflare model page, checked 2026-11-28). So the model family wired
here is **Alibaba Wan** — no new vendor relationship is required to
reach it, and the adapter is provider-swappable (below).

## Provider research verdict (2026-11-28) and the swappable adapter

A dedicated provider survey (full report:
`~/workspace/research_notes/free-video-generation-api-20261128-0904/report.md`)
established that **no provider offers a public API with a non-expiring
free allowance at 50-user volume**: every first-party video API is
paid-only or web-only-free, Cloudflare's perpetual free Neurons do not
cover video models, and Stability discontinued its video API. The best
free buckets are one-time and expiring — **Alibaba Model Studio's Wan
quotas (~600–700 seconds stacked across models, 90 days, Singapore
region)** and the Google Cloud $300/90-day trial toward Vertex Veo. The
cheapest paid floor afterwards is aggregator pricing around
$0.03–$0.10/second (fal.ai ≈ $30–$50/month for 50 users generating one
5-second clip a week at $0.03–$0.05/s — corrected arithmetic).

**Owner decision (2026-11-28): pilot on the free quotas, decide the
paid floor later.** Accordingly:

- `alibaba-model-studio` is the **default** adapter: Wan direct via the
  DashScope async API (create task → poll → result URL; contract
  verified against Alibaba's Wan API reference, 2026-11-28), defaults
  `wan2.7-t2v` / `wan2.5-i2v-preview` — models carrying free-quota
  seconds. Requires the Worker secret `ALIBABA_MODEL_STUDIO_API_KEY`;
  optional `ALIBABA_MODEL_STUDIO_BASE_URL` for a workspace/regional
  domain (default `https://dashscope-intl.aliyuncs.com`).
- `cloudflare-workers-ai` (explicit `IFUND_VIDEO_PROVIDER` selection
  only): Wan via the existing `AI` binding (`alibaba/wan-3.0` /
  `alibaba/wan-2.7-i2v`), dollar-billed per second through AI Gateway
  Unified Billing. It is never a fallback.
- **Pilot quota tracking:** the known free buckets (seconds per model:
  wanx2.1-t2v-turbo/plus 200 each; wan2.5/2.6/2.7 families 50 each;
  wan3.0-video/prime 30 each) live in `FREE_QUOTA_SECONDS` in
  `worker/videoGeneration.js`. Finished generations are summed
  account-wide from the job records; `GET /api/ai/videos/status`
  reports used/remaining seconds per active model plus the pilot expiry
  (`IFUND_VIDEO_PILOT_STARTED_AT` + 90 days), and the Studio shows the
  remaining pilot seconds to members.
- **HARD RULE — no paid spillover:** before reserving allowance, a
  Model Studio request that would exceed its model's free bucket fails
  closed with a 429 "pilot capacity reached" state; a provider quota
  refusal maps to the same state; and during the pilot both active
  models must carry a free bucket — selecting a paid-only model makes
  the feature report not_configured. The only way paid models open is
  the explicit future owner switch `IFUND_VIDEO_ALLOW_PAID_MODELS`.
  No code path falls back between providers: each job records its
  provider and Advance always uses that job's adapter.

Nothing was signed up for and no spend was committed by this wiring;
the Model Studio account itself is the owner's activation step.

## Generative modes

Both modes are true AI generation — the provider creates new footage;
nothing here assembles or renders member-supplied clips.

- **Text-to-video** (`alibaba/wan-3.0`): prompt (safety-framed server-side),
  480P/720P/1080P, ratios adaptive/16:9/9:16/1:1/4:3/3:4, 3–10 seconds
  in this wiring (model range 1–15).
- **Image-to-video** (`alibaba/wan-2.7-i2v`, zero data retention):
  animates a reference image with an optional motion prompt, 720P/1080P
  only, $0.10/s at 720p and $0.15/s at 1080p. The model takes the image
  **only as a URL**, so the source is a member-supplied public https
  link with an explicit rights confirmation recorded on the job.
  Private library media is deliberately **not** an image source: Phase 1
  never mints a public URL for a member's library, and this wiring does
  not break that rule to feed the model.

## The cost fact that gates activation

Wan 3.0 is **not** priced in Neurons. Cloudflare prices it per generated
second — $0.05/s at 480p, $0.10/s at 720p, $0.20/s at 1080p (model page,
2026-11-28) — so it is **not covered by the free 10,000-Neuron daily
allocation** that makes the text/image models free-tier safe. Under the
owner's free-tier-only rule, the wiring therefore ships behind
`IFUND_VIDEO_AI_ENABLED` (default off), the same pattern as
`IFUND_IMAGE_AI_ENABLED`. Enabling it is an explicit owner budget
decision; until then every route reports an honest not-configured state
and the Studio says generation is wired but not enabled. A 5-second 480p
clip costs about $0.25 of provider billing per generation at those rates;
the shared 15-trial / 50-paid-monthly allowance still gates how many
generations a member can consume.

## What was built

- `worker/videoGeneration.js` — provider adapter interface
  (`submit`/`poll`) with the Workers AI implementation, request
  validation, D7 allowance denial mapping, and the durable job lifecycle:
  - `POST /api/ai/videos/generate` — member + AI-consent verified,
    reserves one shared AI creation with kind `video` through
    `ifund_ai_content_reserve` (PR #402 idempotency states preserved),
    records the job (`ifund_video_generations`).
  - `POST /api/ai/videos/jobs/:id/advance` — single-winner claim, runs
    the provider, records the finished result URL on the job **before**
    storage, downloads and verifies the bytes (MP4/WebM signature, 40 MB
    library cap), stores them, and only then completes the allowance.
  - `GET /api/ai/videos/jobs/:id` — owner-scoped poll; never exposes the
    provider URL.
  - `GET /api/ai/videos/status` — `enabled` / `not_configured`.
- `worker/media/memberMedia.js` — `storeMemberMediaBytes` extracted from
  the upload route (identical limits, R2 read-back verification, metadata
  receipt, retained-object rule). Generated videos land through the exact
  Phase 1 pipeline: same private prefix, same `ifund_member_media` row,
  so they list in Saved media, attach to posts under the existing
  own-media trigger, and play through `/api/media/public/file/...` like
  any upload.
- Failure honesty: provider errors fail the job with member-safe copy and
  never complete the allowance; a storage/download failure leaves the job
  in `provider_completed` with the reason recorded, and Advance retries
  **only the save** — a finished generation is never discarded or
  regenerated (D8).
- `apps/web/src/pages/AIVideoStudio.jsx` in the Media Studio Generator
  tab — status-aware section, generation form, submit/advance/poll flow
  that resumes after a dropped connection, retry-save state, and an
  integrity-checked library preview with Send to Editor / Download.
- `supabase/migrations/20261128000000_ifund_video_generation_jobs.sql` —
  **source only, not applied**. Service-role-only table, like the paid
  generation ledger.

## Activation steps (owner, in order)

1. Apply `20261128000000_ifund_video_generation_jobs.sql` to the
   production Supabase project (SQL editor), as with earlier source-only
   migrations.
2. Confirm the Pages/Worker environment has the R2 media binding with
   `IFUND_CAMPAIGN_MEDIA_ENABLED` (already required by the live media
   library) plus `SUPABASE_SECRET_KEY` available to the Worker (already
   used by the media modules), and — for the default provider — the `AI`
   binding.
3. Configure the pilot (the default route):
   - Create the Alibaba Model Studio account (Singapore region) — the
     owner's step; note the workspace domain if using one.
   - Set the Worker secret `ALIBABA_MODEL_STUDIO_API_KEY`, optionally
     `ALIBABA_MODEL_STUDIO_BASE_URL`, and `IFUND_VIDEO_PILOT_STARTED_AT`
     to the account activation date (drives the 90-day expiry display).
   - Verify the current model names and the image-to-video input field
     in the Model Studio console at activation (the survey found region
     wording conflicts between sources). Quotas expire ~90 days after
     account creation; when they end, generation pauses at the pilot
     capacity state — it does not start billing.
   - The metered Workers AI route stays off unless deliberately chosen
     later with `IFUND_VIDEO_PROVIDER=cloudflare-workers-ai` plus the
     `AI` binding (Wan billed $0.05–$0.20/s from the first generation).
   Then set `IFUND_VIDEO_AI_ENABLED=enabled`. Optionally set
   `IFUND_VIDEO_MODEL` / `IFUND_VIDEO_I2V_MODEL` to override the active
   provider's models (during the pilot they must stay within the free
   quota map or the feature fails closed by design).
4. Deploy through the normal authorized release, then run the frontend
   acceptance pass as a signed-in entitled member (generate, save,
   attach to a post, play) per the repo's acceptance rules — source tests
   with a mocked provider do not substitute for that live check.

## Related: AI caption wording (same delivery)

Per the owner's follow-up directive, generated media can now carry
AI-drafted caption wording: `POST /api/ai/captions/generate` (member +
AI-consent gated; llama text model on the free Neuron allocation, so no
enable flag) drafts wording for the Media Studio artwork caption and the
campaign cover caption. Every draft passes the deterministic coherence
guard in `apps/web/src/lib/captionQuality.mjs` (real words only — no
invented words, letter salad, or keyboard mash; names, hashtags and the
member's own context words are never false-flagged) and the
public-facing discretion scan. One corrective regeneration on failure,
then the campaign title as a labeled fallback. The print contract is
unchanged: models still draw no lettering, and only member-approved
exact text is rendered onto artwork.

## Known limits

- The Workers AI binding call resolves with the finished result
  (Cloudflare's documented binding contract), so this adapter's `submit`
  completes synchronously inside Advance; the adapter interface and job
  states (`provider_pending`) already support a future async provider.
- Editing/optimizing generated videos (the Studio Editor's viewing
  controls, frame stills) works on the stored file like any upload;
  provider-side video editing is out of scope for this wiring.
