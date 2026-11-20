# iFund paid campaign email and Agent Team memory — production runtime checkpoint

Owner policy: an account-owned `@interplanetaryfund.com` campaign email identity requires an **active provider-verified paid iFund membership**, an explicit selection, and for Basic a **separate $1 USD/month recurring PayPal subscription**. No trial, day pass, admin grant or email reservation counts as payment. A real email identity is still **inactive** until billing and routing are confirmed.

## Verified production routing (2026-11-20 UTC)

Cloudflare zone `interplanetaryfund.com`:

| Route pattern | Worker |
| --- | --- |
| `interplanetaryfund.com/api/payments/*` | `ifund-payments` |
| `www.interplanetaryfund.com/api/payments/*` | `ifund-payments` |
| `interplanetaryfund.com/api/payments/email-addon/*` | `ifund-email-addon-billing` |
| `www.interplanetaryfund.com/api/payments/email-addon/*` | `ifund-email-addon-billing` |

The more-specific email-add-on routes **must not be removed**: the broad payments route otherwise intercepts add-on status and returns HTTP 404. The new routes were tested live: guest add-on status returns HTTP 401 on both hosts, the existing subscription-plan catalog remains HTTP 200, and /agents remains HTTP 200. The Cloudflare configuration was mutated directly and verified using its API. The two add-on route identifiers are `e382cdd93e634253999230d6ccf7f213` (apex) and `44ede9cab2e6497b94745854d52e49dc` (www).

Cloudflare Pages production deployment `aff02824-2748-4e38-bbfc-12082f3c9cb7` serves main commit `feb82f62fbe869da886b39071282e621918ca839`, after a preview with 74/74 root and 938/938 frontend tests passing. Git automatic builds remain disabled.

## Paid email security and delivery

- Cloudflare Email Routing catch-all still points to existing `ifund-email-ingress`. Do not replace it: it also handles business/admin mail.
- Signed inbound messages reach Supabase function `ifund-member-mail-ingress`; paid apex-domain recipients call the service-role-only `public.ifund_receive_paid_campaign_email` function.
- That receiver now calls `public.ifund_paid_campaign_email_inbound_recipient`, a service-role-only gate requiring active paid Basic membership, an explicit alias opt-in, live $1 recurring billing evidence, a registered verified PayPal plan, valid paid-through date, and verified routing.
- Separate billing Worker `ifund-email-addon-billing` has an authenticated member status/start API and a signed PayPal webhook handler. Source is `workers/ifund-email-addon-billing/index.mjs`.
- Supabase Edge Function `ifund-email-addon-ledger` v2 verifies signed backend evidence. Provider events are staged in a private append-only ledger, then reconciled through service-only `ifund_reconcile_campaign_email_provider_event`; neither stage grants delivery without routing verification.
- **Current external blockers:** no verified $1 PayPal plan registered; `IFUND_EMAIL_ADDON_PLAN_ID` empty, `IFUND_EMAIL_ADDON_WEBHOOK_ID` empty, `IFUND_EMAIL_ADDON_CHECKOUT_ENABLED=disabled`. There are zero recorded add-on payments and zero active member aliases. Do not enable checkout or claim mail delivery until the live PayPal plan, signed webhook, and owner/member acceptance tests pass.
- When a provider webhook is created, verify its live PayPal app/webhook ID belongs to the same merchant. Do not reuse an unrelated webhook ID merely because it exists on `ifund-payments`.

## Agent history

- Agent Team question Worker `ifund-agent-question` is enabled for advisory answers; shared history remains `IFUND_TEAM_CONTEXT_ENABLED=disabled`.
- Owner-scoped team history and user correction functions exist in Supabase. A narrowly scoped secondary writer-verification function and private control table were added without rotating the STORY Worker production credential.
- The scoped control is deliberately disabled because no separate secret was provisioned. Do not turn on history until the Worker secret and matching private digest are configured and verified with an authenticated member's actual question, generated response, retrieval, and cross-account isolation checks. Do not copy the existing STORY executive secret into browser code or repositories.
- UI completion requires a genuine role-based end-to-end task and persistent result; builds and API 200/401 alone do not count.

## Release evidence still required

1. Verify PayPal's **actual** independent $1/month plan and webhook via provider API, with no trial/setup fee and the correct merchant.
2. Confirm a paid Basic user can opt in, approve the separate recurring subscription, produce a genuine completed $1 sale, and have the entitlement reconciled. Verify cancellation/refund suspends access.
3. Prove a real signed inbound email lands in **only** that owner's private inbox, associated with an owner-approved campaign, and existing business inboxes remain unaffected.
4. Exercise member/admin agent workflows as their intended role, including shared memory write/reload, campaign handoff/save/reopen, and external connection consent. Treat missing authorized sessions as blocked, not passed.

This checkpoint records implemented runtime, known blockers, and safe release boundaries. It does not assert successful paid-member, administrator or real-money acceptance.
