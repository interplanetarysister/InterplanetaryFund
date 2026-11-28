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
(Cloudflare model page, checked 2026-11-28). So the provider wired here
is Cloudflare Workers AI and the model is `alibaba/wan-3.0` — no new
vendor account, no new API key, no second credential vault.

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
2. Confirm the Pages/Worker environment has the `AI` binding and the
   `IFUND_CAMPAIGN_MEDIA` R2 binding with `IFUND_CAMPAIGN_MEDIA_ENABLED`
   (already required by the live media library) plus `SUPABASE_SECRET_KEY`
   available to the Worker (already used by the media modules).
3. Decide the budget posture for per-second billing (above), then set
   `IFUND_VIDEO_AI_ENABLED=enabled`. Optionally set `IFUND_VIDEO_MODEL`
   to override `alibaba/wan-3.0`.
4. Deploy through the normal authorized release, then run the frontend
   acceptance pass as a signed-in entitled member (generate, save,
   attach to a post, play) per the repo's acceptance rules — source tests
   with a mocked provider do not substitute for that live check.

## Known limits

- The Workers AI binding call resolves with the finished result
  (Cloudflare's documented binding contract), so this adapter's `submit`
  completes synchronously inside Advance; the adapter interface and job
  states (`provider_pending`) already support a future async provider.
- Editing/optimizing generated videos (the Studio Editor's viewing
  controls, frame stills) works on the stored file like any upload;
  provider-side video editing is out of scope for this wiring.
