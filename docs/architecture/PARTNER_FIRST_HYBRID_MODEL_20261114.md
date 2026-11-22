# iFund partner-first hybrid model — execution contract

**Owner decision:** 2026-11-14. **Status:** approved direction, NOT a claim of shipped features or live provider partnerships.

## Positioning and constraints
Interplanetary Fund is the AI-powered fundraising growth, distribution and measurable-success operating system. Integrate with existing fundraising hosts rather than forcing campaign owners to abandon them. Keep currently verified first-party fundraising while implementing external-campaign linking and partner-directed contributions.

**Never** receive a contribution destined for an outside provider, deduct the existing iFund 3% withdrawal fee, and forward the remainder without independent contract, payment-provider clearance and applicable legal review. External donations go **directly to the provider's authorized checkout**. Keep existing iFund PayPal donation, 3%-at-withdrawal, payout, refunds and ledger intact unless separately authorized and tested. Do not imply tax deductibility or receipt responsibility for external payments.

## Canonical architecture
- Code: `interplanetarysister/InterplanetaryFund`, `apps/web`; Cloudflare Pages/Workers/R2; Supabase production remains sole durable application database. Independent `apps/mobile` must use the same backend and data, not the Base44 APK. Base44 reference repo and existing APK must remain unchanged.
- Model **external campaign links** as owner-scoped child records on canonical campaigns with provider identifier, HTTPS campaign URL, claim/verification status, created timestamp, revoked status and applicable consents; one campaign may reference multiple authorized destinations. URL linking does not verify host ownership.
- Validate provider host using a strict allowlist or verified provider-specific URL parser; reject spoofed subdomains, non-HTTPS, credentials and non-campaign routes. Avoid accepting arbitrary payment URLs as approved checkout links.
- Add partner capability registry separating `public_link_only`, `oauth_authorized`, `read_api_authorized`, `webhook_authorized`, `checkout_authorized`. API access or partnership is never inferred by the existence of a website or user-submitted URL.
- External donor CTAs must plainly name the destination, use its authorized outbound campaign/checkout URL and never pass funds through first-party payment endpoints. First-party campaigns retain existing, verified checkout semantics.
- Separate event types: outbound tracked click, session, confirmed referral, provider-confirmed payment, owner-reported amount, estimate and sandbox. Use immutable identifiers, idempotency and integer minor units/currency for verified financial events. Disallow writing partner amounts into the first-party ledger.
- Source labels, sync timestamps, ownership, privacy and retention rules are required for charts, campaign dashboards and partner reporting.
- Support consented agency automation with auto/ask/draft/manual; campaign writing/image suggestions must not fabricate beneficiaries or claim likelihood of success.

## Agent and subagent responsibilities
| Owner | Implementation | Minimum acceptance |
|---|---|---|
| Agent 1 Frontend | Destination selector, external link management, provider-direct CTA disclosure, creator analytics, readiness rubric, independent mobile UI | Keyboard and accessibility, invalid URL, guest-to-owner, no invented totals |
| Agent 2 Backend | Additive external mapping, owner RLS, URL parser, APIs, event provenance, secure mobile auth | Unauthorized user/other-owner denied, malicious URL rejected, replay safe |
| Agent 3 Finance and Connections | Preserve first-party PayPal/ledger, isolate external donations, partner authorization and referral economics, consent/store-policy checks | No 3% fee on outside gifts, no money forwarding, provider receipts accurately attributed |
| Agent 4 QA/Release | Unit/integration/security tests, route matrix, mobile isolation, finance provenance, external redirect and permission checks | Negative tests and provider proofs; keep existing fail-closed release gates |
| Agent 5 Coordinator | Subagent routing, conflict avoidance, backlog prioritization and evidence-based milestones | Source-only vs preview vs production tracked; website/admin repairs remain first |
| Campaign Coach | Transparent improvement scoring and factual writing | No false success predictions |
| Outreach and Communications | Consent-based share planning, campaign marketing | No unauthorized publishing |
| Insights | Source-linked attribution and analytics | Clicks not gifts; no unsupported causality |
| Partner Operations | Provider approvals and capability matrix | No invented partnerships |
| Security/Compliance | Consent, RLS, partner terms and state charitable fundraising review | No unapproved custody/disbursement |

## Delivery sequence
1. Inspect current route, payments, Connections PR #286 and analytics ownership. Do not duplicate their files/grants or change production settings.
2. Implement and test owner-managed external campaign links with safe URL parser and direct-to-provider navigation while retaining first-party campaigns.
3. Add tracked links and provenance-aware analytic dashboard with clear distinctions between verified and self-reported values.
4. Add provider API/OAuth and webhooks only with documented permission and signed event verification.
5. Pilot with consenting real campaigns; assess activation, link clicks, verified conversions where data exists and user retention. Seek official partner relationships and B2B/white-label pilots once evidence exists.

**Release policy:** no automatic build; preserve full-site route acceptance, preview-first verification, production evidence and separate owner authorization. Source edits or scheduled-agent instructions are not deployments. Do not change DNS, Base44, money movement or paid infrastructure through this migration.
