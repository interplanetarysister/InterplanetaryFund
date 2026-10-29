# Campaign Creation Parity and AI Gateway Port Audit — 2026-10-29

## Status

The independent web build does not yet provide campaign-creation parity with the Base44 application. This audit records the source behavior and the safe port boundary. It does not claim that AI generation is implemented or enabled.

## Confirmed source workflow

The source repository's `src/pages/CreateCampaign.jsx` implements a four-step campaign creator:

1. Your Details
2. Basics
3. Your Story
4. Launch

The workflow includes resumable drafts, step persistence, location lookup, optional voice assistance, campaign cover generation, and launch validation. Its copy workflow uses `CampaignCopyChoices` for five title choices and five short-description choices, with separate regeneration. Its story workflow uses `AIStoryGenerator` for a single authoritative story, fresh takes and edits, and version history/restore. Cover generation uses a provider response, validates the returned image URL, brands/uploads the image, and preserves the previous cover if generation fails.

The current independent page `apps/web/src/pages/CreateCampaign.jsx` is a single-page manual form. It persists only title, summary, story, category, goal, and cover URL. It has no title/summary suggestion UI, story generation/history, image generation, step progress, location, AI profile, or voice assistant.

## Gateway findings

The source gateway `host/gateway/campaign-assistant.js` is not portable as-is:

- It calls the Base44 app API to resolve the user and feature availability.
- It depends on Cloudflare AI binding `env.AI` and a rate limiter binding `env.CAMPAIGN_AI_LIMITER`.
- It is disabled unless `IFUND_CAMPAIGN_AI_ENABLED=enabled`, the AI binding exists, and the limiter exists.
- It uses Cloudflare Gemma for text and Flux Schnell for image generation.
- It allows only configured origins and requires a bearer token, but its identity check is still Base44-dependent.
- It does not prove that equivalent bindings, quotas, provider permissions, or cost eligibility are configured for the independent production environment.

No provider invocation, secret, paid fallback, or AI enablement was added during this audit.

## Required independent implementation contract

Before enabling AI generation in the independent app:

1. Replace Base44 identity lookup with canonical Supabase JWT verification at the Worker boundary. Validate issuer, audience, signature, expiry, and user status; never trust a user ID supplied in the request body.
2. Replace Base44 feature lookup with a server-owned feature/entitlement decision. Client flags are presentation only and cannot authorize inference.
3. Require an explicit provider binding and per-user rate limiter. Set request-size, output-size, concurrency, and daily quota limits. Fail closed when either binding or configuration is absent.
4. Do not silently fall back to a paid provider. Expose a truthful unavailable state when free eligibility, provider permissions, or quota configuration cannot be established.
5. Keep campaign facts as untrusted prompt data. Preserve the no-fabrication rules, validate structured outputs, reject duplicate/empty choices, and never overwrite creator text on a failed request.
6. Persist the requested UX: exactly five title options, exactly two short-description options, one generated authoritative story, independent regeneration controls for title, description, story, and cover image, and story version/restore. Each generation result must be user-selectable/editable before save.
7. Generate cover images only after the user requests it. Verify the generated asset loads, brand/store it through the approved independent storage path, and retain the previous cover on failure.
8. Add tests for anonymous/expired/forged tokens, unauthorized feature access, limiter rejection, missing provider bindings, malformed outputs, duplicate choices, prompt injection, oversized requests, and failure preserving the current form.
9. Mirror the finished experience and user-facing copy across the independent web and app surfaces without coupling either runtime to Base44.

## Release gate

Campaign creation remains a prebuild blocker until the independent four-step creator and all required copy/story/image behaviors are implemented and exercised end-to-end with the canonical backend. A successful Vite compilation does not satisfy this gate. AI must remain explicitly unavailable until its independent auth, feature, provider, quota, and cost controls are verified.
