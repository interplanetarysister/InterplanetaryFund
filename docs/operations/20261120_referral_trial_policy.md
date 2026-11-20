# IFund premium access and referral policy — November 20, 2026

Owner product decision: maintain the three-step AI-assisted campaign creator and make the persistent Agent Team companion available for page navigation. Give new verified signups 24 hours of premium Team access once the verified service launches. Each verified referral who publishes their first IFund campaign earns the referring member an additional **24 hours**. Referral time is not cash, commissions, an affiliate payment or a promise of crowdfunding success.

## Eligibility and safeguards

- One randomly generated shareable referral code per verified member. Public signup link: `https://interplanetaryfund.com/register?ref=<code>`.
- A referred member may redeem one code during the first 14 days of registration, before any campaign is created. Existing accounts cannot be credited retroactively, and self-referrals are rejected.
- A successful referral qualifies only when the referred verified member publishes an actual first campaign, not simply by saving a draft. The database awards at most once per referred user and stores the qualifying campaign record.
- A successful reward is 24 hours of additional agent trial time, added to the existing trial expiry when active. If the AI service is offline or the trial has not launched, hours are banked without an expiring clock.
- New signup trial: 24 hours for accounts registered after the launch timestamp. Existing members may share referral codes and earn qualifying bonus time, but are not backfilled with an unwarranted signup trial.
- Trial and paid entitlements remain separate. Trial access does not activate a paid email add-on or grant financial, admin, OAuth, social-publishing, or payment authority.
- Backend activation defaults to **off** (`public.ifund_agent_trial_control.enabled=false`). Do not turn it on without verified AI gateway, anti-abuse quotas, identity gating and responsive authenticated acceptance.
- Target new premium subscription price: **$4.99 per month**. The target is staged as 499 cents; the existing live PayPal Basic catalog remains at its independently verified price until a new provider-backed plan and atomic ledger/webhook acceptance are complete. There is **no automatic subscription after trial expiry**, no unilateral payment-provider price change, and no fake provider receipts.
- "Unlimited" must not mean unrestricted paid API compute without cost control. All Team features can be made available during the trial, but real inference remains governed by provider service limits, consent, safety, and anti-abuse protections. Do not advertise unlimited conversations until the actual runtime supports the claim.
- The frontend displays a truthful inactive-trial state while retaining functional referral code generation and qualifying-hour banking.

## Release evidence and verification

- `supabase/migrations/20261120195000_ifund_agent_trial_referrals.sql` is the source of truth. It creates private RLS-protected referral accounts/claims, explicit owner-only status and claim RPCs, a trigger-only qualification grant, and a trial extension of the existing canonical entitlement read without modifying paid receipts.
- The SQL was compiled in a production-schema transaction and rolled back before applying. Verified RLS is enabled, anon cannot issue/redeem codes, authenticated can invoke the guarded RPCs, the trial switch is off, and $4.99 desired price is 499 cents.
- Do not turn off safety gates, mint referral credits client-side, or give referrers cash, guaranteed donations, payouts, or free account email addresses.

## Future acceptance required before trial and $4.99 billing launch

Verify actual live Workers AI binding and Agent Team question gateway, rate/cost monitoring, new signup with email verification and referral claim, first eligible published campaign and idempotent credit, non-owner denial, account deletion cascades, and billing plan identity/webhooks. Do not alter the canonical first-party 7% withdrawal fee.
