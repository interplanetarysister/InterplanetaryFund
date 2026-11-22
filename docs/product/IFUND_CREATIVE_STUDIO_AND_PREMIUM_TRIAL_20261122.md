# IFund Creative Studio: product and integration contract

Approved owner direction, November 22, 2026. This is the **build contract**, not a claim that audio/video providers or publishing permissions are live. Stitch is preparing the future UI; do not overwrite or independently invent its screens.

## Premium discovery and free experience

- Make premium membership obvious but optional on Dashboard, Agent Team chat, campaign-writing step, image/creative studio, and whenever verified quota exhaustion occurs. Reuse the small `PremiumOpportunity` link to `/subscriptions` and authoritative `TrialCreationBalance` display. No popups blocking manual work, no repeated aggressive upsells and no nested campaign-creation cards on mobile.
- During the 24-hour signup trial and earned 24-hour referral extensions, at most **15** AI-generated content items or accepted queued creation requests **across eligible creative tools combined**, not 15 per tool. Paid members retain independently provider-verified plan allowances. Ordinary free writing, manual editing, file uploads, campaign publishing, browsing, navigation help, and profile settings remain available after trial expiry or quota exhaustion.
- One unit counts for one AI-created artifact request: AI story, section rewrite, generated or enhanced image, original audio/music, audio edit, video or video edit, or composed marketing/social creative. A batch producing several deliverables must be charged according to its actual item semantics before launch; do not relabel a batch of twenty videos as one item.
- The verified backend is `public.ifund_trial_ai_generation_{reserve,complete,status}` and the private release function. It is fail-closed, owner-scoped, durable across devices, idempotent per request, uses row-level security and a single shared total. The release RPC is **not callable by normal browser members** to prevent reservation tampering; failed reservations expire in 30 minutes. A trusted service-only completion/cleanup bridge may be introduced after separate security review. Never increment or authorize from localStorage or the browser.
- `worker/trialAiContent.js` is the shared Worker integration. Each future provider adapter must reserve before requesting inference, finalize only confirmed generated work or a confirmed queue job, and use the same user's JWT and a bounded request identifier.
- The current implementation includes campaign-story responses, original image generation and image enhancement. Social posts/marketing, music/audio, and video generation are **not covered by live provider adapters yet** and must not be presented as available merely because the enum includes them.
- Existing cloud/provider limits, image rolling-week paid limits, AI consent, anti-abuse rules, and fair-use caps still apply; the 15-item rule does not mean unlimited cloud expenditure.

## Design: one professional creative workspace

- **Create**: social graphic, marketing artwork, short promotional video, longer campaign film, original soundtrack, voice-over, audio cleanup, or mixed social post.
- **Brief**: clear short prompt with optional permitted supporting images/files. Distinguish user-furnished facts from AI visual imagination. Never invent actual fundraising outcomes or imply official sponsorship.
- **Editor**: assets bin, image canvas and layers, video timeline with cuts/captions/transitions, audio tracks, original music/voice editor, brand styles, format presets for specific platforms, and preview-before-export. Mobile-first with progressive disclosure; no complex settings required to start.
- **Outputs**: correctly sized variants for social sharing/marketing, downloadable assets, optional campaign cover and draft social posts. Opening a provider authorization flow is not permission to post automatically. Publishing, outreach and monetary actions remain explicit and approval-gated.
- **Accessibility**: captions, transcripts, alt text, visible volume and motion controls, keyboard-accessible editing controls, readable contrast, careful auto-play defaults.
- **Copyright and licensing**: user must have rights to edited source imagery/music/video; preserve original user data, require clear permissions for cloned voice/personality, use owned/licensed/authorized sound; do not imply generated copyrighted songs are cleared. Review platform and provider terms, content moderation, and provenance before production.
- **Privacy**: keep project drafts owner-scoped and media encrypted/private by default. Use R2 signed storage manifests and content-scoped authorizations; no raw binary blobs inside relational ledger records. External provider uploads need explicit consent and a retention/delete story.
- **Finance and plans**: target Basic $4.99/month, only if exact provider plan, webhook signatures, durable billing, refunds/cancel, and mobile-store rules are verified. Never trigger automatic billing after the 24-hour trial. App-store payments require separate platform acceptance. The current Basic provider plan remains unverified; all checkout links must accurately show pending availability.
- **Fraud**: referrals award 24h only after verified first published campaign; do not pay for self-referrals or clicks. Quota and referral audits must use backend records.

## Prioritized implementation order

1. Finish and test shared 15-item quota across currently existing AI generation adapters; verify 15th pass, 16th denial, paid exemption, account isolation, no quota bypass, provider failures and manual work afterward.
2. Integrate Stitch UI into the current canonical React project without changing route names or replacing the three-page campaign editor. Keep created UI on preview before production.
3. Build **real** audio, video and social adapters only with provider approvals, authenticated storage, usable generated output, editor functionality and quota receipts. Show unsupported options as future capabilities, not as functioning buttons.
4. Validate subscription provider-backed $4.99 recurring payment readiness separately; leave enrollment disabled until end-to-end acceptance.
5. Perform signed-in member, donor, non-owner, admin, real worker binding and provider QA before broad activation.

The existing three-page campaign creation with optional AI story remains the primary low-effort user flow. The landing prompt prefills its fields and does not funnel users through arbitrary pages.
