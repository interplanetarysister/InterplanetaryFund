# What If? AI planner — isolated preview Worker

This Worker is **already deployed** as `ifund-what-if-ai-preview` and is bound only to Cloudflare Pages preview as `IFUND_WHAT_IF_AI_SERVICE`.

- Main module: `index.mjs`; consumes the shared `worker/missions/plan.js` route.
- Permissions: real Supabase Auth bearer, active confirmed member, current Terms, explicit AI drafting preference, owned private Mission, valid input revision, durable daily request quota.
- Result: private proposed plan requiring an explicit owner review and save; **no automatic external actions or payments**.
- Cloudflare binding: `AI` (Workers AI). The source currently requests the existing Llama 3.3 70B model. Use only within verified free allocation; it cannot be represented as unlimited free usage.
- Variables: `SUPABASE_URL` is the canonical project URL; `SUPABASE_PUBLISHABLE_KEY` is attached in Cloudflare settings, not checked into source. Never use a service-role or sb_secret browser key.
- Release gate: Pages preview has `VITE_IFUND_WHAT_IF_ENABLED`, `IFUND_WHAT_IF_ENABLED`, and `IFUND_WHAT_IF_AI_ENABLED`; production retains all What If? flags disabled pending signed-in browser acceptance.
- Manual deployment uses Cloudflare Pages ad hoc Git branch deployment. GitHub Actions minutes must not be consumed.

The deployed Worker was uploaded through the Cloudflare API as six ESM modules: this entrypoint, shared Mission plan handler, member authentication, team-context credential redaction, JSON body bounds, and the existing internal AI consent classifier.

Do not deploy this Worker over the existing `ifund-agent-question` service; that service supports other production AI features.
