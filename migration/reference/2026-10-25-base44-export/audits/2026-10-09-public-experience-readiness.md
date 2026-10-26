# Interplanetary Fund: public experience and connection readiness
Date: 2026-10-09, America/Los_Angeles
Authoritative source: Base44 main. Do not use GitHub Actions or assume GitHub as publication source.

## Source-implemented and statically tested
- Public /u/:id member profile. Owner edits the profile, chooses up to six active owned/followed campaigns, one priority campaign, community and post visibility. No account email, secret, private balances or payment provider IDs are exposed through the profile function.
- Social author and community member names link to public profiles; joined groups and public discussions/replies can appear when opted in.
- One lasting personal blog per member, recurring paid-plan entitlements for editing/creating, drafts and published entries, public read access, plus the official IFund Reporter newsletter.
- Three truthful official reporter introductions are stored as published BlogEntry records. Daily Reporter workflow is authored but provider execution in the live runtime is not independently confirmed.
- Safe campaign embed parsing from IFund-specific iframe, [campaign:id] or canonical public IFund campaign URL, native CampaignCard rendering to the campaign page. Arbitrary pasted scripts do not execute.
- The Community Stories & blogs tab and the group-level newsletter link.
- Shared responsive mobile bottom bar (AI Chat, Profile, IFund Social, Forums) and QuickActions floating menu on Home and the app. Public social feed is read-only for guests.
- Connections help entry in both Help Center and Connections; direct provider sign-in through an app-user connector when configured, owner-specific verification, visible pending agent work, and steps for token/public-link platforms.

## Active blockers / not verified
- Provider account sign-in/MFA codes are issued by each external service, not IFund. The user may still have to authenticate and approve. Installed Base44 connector support is not equivalent to per-user app OAuth configuration; verify APP_USER_CONNECTOR_* IDs, redirect URLs, scopes, live provider identity and provider callbacks individually.
- Managed Connections requires the owner’s paid tier and current IFund OBO consent. Per-connection refusal is binding. Public browser automation, arbitrary account creation, and some provider write paths still lack safe executable routes: runBrowserConnection currently fails closed.
- Facebook/Instagram official publishing remains a prepared/draft process until provider accounts, permissions, and actual API publishing are verified. The configured official on-site reporter diary is independent of those destinations.
- New paid subscription checkout is controlled by a disabled feature flag until payment/provider verification is resolved. A member cannot buy new access solely because the blog UI exists.
- The PayPal business-account integration, final donation crediting, real money ledger reconciliations, withdrawals and refund safety are not certified in this pass. Do not enable financial flows from a UI-only success response.
- Web probes cannot access interplanetaryfund.com from the present verification environment. Base44 code completion, successful local build and a checkpoint do NOT establish that a newly published production deployment is available.
- Full account security review, financial verification, and Help Center chatbot/guide remain separate workstreams, not yet signed off.
- Browser navigation smoke tests cover a desktop viewport and one small mobile viewport; require production device/browser acceptance testing on other supported devices.
- Exhaustive closure of every externally dependent feature across all 48 routes is NOT evidenced by the current static test suite.

## Acceptance gates before announcing feature completion
1. Confirm Base44 main checkpoint is the version deployed at interplanetaryfund.com.
2. Test signed-out public profile/blog/article routes and signed-in profile/blog create/edit/publish flows against live RLS and app-user identity.
3. Test provider-by-provider auth, MFA callback, unbound managed connection task completion, and actual provider-native connection health.
4. Exercise a published embedded campaign card on mobile and desktop; verify the campaign donation link and appropriate prelaunch/payment notices.
5. Run live financial reconciliation separately, only with the user’s authorized business account and non-destructive test procedures.
6. Verify consent, authorization, rate limits, moderation, account deletion and public/private data boundaries.
7. Run accessible keyboard, mobile viewport, push/download/PWA and true logged-out navigation checks.
8. Review chatbot, help content, help-center guide and service/support escalation.
