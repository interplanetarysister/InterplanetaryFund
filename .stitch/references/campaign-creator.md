# Campaign creator

**Routes:** `/create` (capture `?manual=1`), `/campaigns/:id/edit`, `/templates`  
**Owners:** `apps/web/src/pages/CreateCampaign.jsx`, `EditCampaign.jsx`, `CampaignTemplates.jsx`  
**Shell:** Inside `Layout`. `GlobalAgentCompanion` supplies the floating account and Ask IFund controls and the one-time page guide; `QuickActions` remains bottom-left.
**Capture:** @html/campaign-creator-desktop.html, @html/campaign-creator-mobile.html, @screenshots/campaign-creator-desktop.png, @screenshots/campaign-creator-mobile.png. Captured in the guest manual-entry render state; no draft was saved and the signed-in tour is not present. The first card captures the expanded NEXUS voice guide; the second card captures the artwork disclosure with exact caption text in @html/campaign-voice-artwork-desktop.html and @html/campaign-voice-artwork-mobile.html; the final card is captured in @html/campaign-launch-eclipse-desktop.html and @html/campaign-launch-eclipse-mobile.html.

## Purpose

The creator is a guided writing and launch workspace, not a marketing page. It helps an owner describe a real fundraiser, review AI-assisted suggestions critically, preview the public page, and only then save or publish. Privacy and ownership warnings are part of the interface.

## Component topology

`CreateCampaign` param gate → `NewCampaign` session phase → `CampaignEntry` private-setup recovery → `CampaignComposer` keyed by `(draft|new):(owner|guest)`. Private drafts and edits are wrapped in `MemberAccess`; guest drafting is browser-only.

Supporting surfaces: `ExternalCampaignHandoff`, `CampaignDocuments`, `AgentAdviceReview`, `WritingDraftReview`, `CampaignLocationFields`, `AgentFeatureLauncher`, `CampaignVoiceGuide`, `CampaignImageChoices`, `CampaignTemplatePreview`, `CampaignReadinessScore`, `PrepublicationGate`, `PrelaunchNotice`, `PageError`.

## Section order and anatomy

1. **Single cosmic card.** `CreateCampaign` renders one `max-w-2xl rounded-[2rem] border border-cyan-300/25 bg-slate-950` card on a `max-w-3xl` page. The header shows `What If? · CAMPAIGN`, `{step+1} / 3`, an `<h1>` with the exact words "Your idea", "Your story", or "Ready to share", and a one-line prompt appropriate to that step.
2. **Three-icon stepper.** `WIZARD_STEPS = ["Campaign basics", "Your story", "Review and publish"]` supply button titles and `aria-label`s for a centered `grid grid-cols-3` of `Target`, `BookOpen`, and `Rocket` icons. Each button is at least 48px tall and marks the active step with `aria-current="step"`; future steps are disabled. Panels are toggled with `hidden`, so preserve field values and focus context in any redesign.
3. **Step 0 — Your idea.** The first panel asks for "Campaign name" and "What are we making possible?", then `CampaignVoiceInput` with "Talk instead" / "Hear the question", "How much would help? (USD)", and a collapsed "A little more context (optional)" group for beneficiary, need, support type, category, tone, facts to preserve, and writing style. A collapsed "Talk through it with NEXUS (optional)" disclosure contains `CampaignVoiceGuide`; its own visible label is "Have NEXUS guide me by voice (optional)". "Already fundraising somewhere else? (optional)" contains `ExternalCampaignHandoff` and stays a direct-to-provider link.
4. **Optional NEXUS voice guide.** The guide offers Quick setup / Detailed guidance and text-labeled Answer by voice / Hear question / Skip controls. Support options come from the shared 12-item `supportNeeds.mjs` catalog with **Not sure yet** first; a noncash answer skips the dollar-goal step. Spoken answers only fill editable draft fields; microphone access is never continuously active and no voice answer authorizes publication.
5. **Step 1 — Your story.** The primary textarea is "Your story". "Help me write this with AI" offers editable title, summary, and story suggestions. A collapsed "Add photo or illustration (optional)" group holds the cover upload, `CampaignImageChoices`, the preview, and "Use an image URL instead". A collapsed "More editing tools (optional)" group holds the short description, `CampaignDocuments`, `WritingDraftReview`, `AgentAdviceReview`, story sections, and previous story versions.
6. **AI cover provenance.** `CampaignImageChoices` uses one cohesive **Interplanetary Fund signature** campaign-cover illustration style (interstellar atmosphere, cosmic geometry, futuristic forms, restrained cyberpunk light and expressive graphic-novel composition), not split style categories, and provides an **Image words (optional, exact spelling)** field with **Use campaign title exactly**. The image model draws without lettering; iFund overlays up to 100 owner-supplied characters in a regular font. The caption is never machine-corrected, and the resulting preview must still be reviewed: it is illustrative artwork, not documentary evidence. Trial/subscription entitlement and the server-enforced paid 50-attempt rolling seven-day allowance, plus shared provider pacing, are verified by the server; no image is published automatically. Applying generated art records `cover_image_is_ai` in private setup metadata and a non-networked `ifund-ai-artwork` URL fragment so public detail can label it "AI-generated illustration" without adding a campaign column.
7. **Step 2 — Ready to share.** The review card shows the owner's current title, summary, cover, goal, and story, followed by the readiness list. "Preview or advanced settings (optional)" holds `CampaignTemplatePreview`, end date, private location note, `CampaignLocationFields`, and `AgentFeatureLauncher`. The visible copy states "Publishing does not require an AI review or a story-length target. You may improve your campaign afterward in Command Center." The rule remains that publishing requires neither AI review nor a story-length target. The card carries `.ifund-eclipse-moment`, but the old "Your defining moment" caption is no longer used.
8. **Actions and footer navigation.** Save draft / Continue appear on the first two steps; Back / Save draft / Continue or Back / Publish campaign appear in the footer with explicit busy labels. Publish stays disabled until `readiness.ready`.

Editor route adds status pill, `CampaignDocuments`, `CampaignReadinessScore`, `PrepublicationGate`, Pause/Publish/View public actions, and hash deep-links `#campaign-title|summary|story|goal|atlas-location`.

## Visual tokens

- Root: `mx-auto w-full max-w-3xl px-3 py-4 pb-28 sm:px-6 sm:py-8`.
- Single card: `mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-slate-950 text-white shadow-2xl`; local radial/line gradients supply cosmic depth.
- Header: `text-xs uppercase tracking-[.2em] text-cyan-200`, `font-display text-2xl sm:text-3xl` heading, and `text-sm text-slate-300` prompt.
- Inputs: `mt-2 w-full min-h-12 rounded-2xl border border-white/20 bg-slate-950/60 px-4 py-3 text-base text-white`; focus ring cyan.
- Voice/artwork disclosure: cyan-bordered `<details>` with 44px controls and textual status; exact-caption input is a labelled full-width field with 44px minimum height and an adjacent text button; generated-art preview `max-h-64 rounded-xl object-contain`.
- Eclipse review: `.ifund-eclipse-moment` on the step-three card, `cosmic-eclipse.svg` background over `#080D22`, inset cyan border, and the exact caption "Review it, then decide when to publish." No invented progress or receipts.
- Stepper: centered 3-column grid of 48px rounded icon buttons; active step uses cyan fill and border, future steps are dimmed and disabled.
- Actions: 48px minimum, `rounded-xl`, 20–24px horizontal padding; disabled `opacity-50`.
- Legacy `.campaign-quest` styles exist in `index.css` but are not used by the current creator markup; do not reintroduce them as the primary visual language.

## States to preserve

- Session loading ("Opening your campaign editor…"), draft loading, draft load error, wizard error, progress notice.
- Browser storage unreadable block with retry.
- Guest-draft import choice and cleanup retry.
- Autosave error with retained private browser copy warning.
- Upload validation: JPG/PNG/WebP/AVIF, 5 MB limit; upload progress and receipt.
- Voice input: unavailable browser, permission failure, "Listening…", stop, and spoken text appended after the current value without overwriting typing; talkback unsupported state.
- NEXUS voice guide: quick/detailed mode, each question and status, skip, noncash support skipping the dollar-goal step, completed guidance, and restart. Microphone access is never continuously active.
- Original artwork: style selection, optional exact caption and title-copy action, title/description prerequisite, generating/uploading/saved statuses, ineligible/shared-capacity/provider-unavailable errors, preview, discard, and AI-cover disclosure. No image is published automatically and no caption spelling is silently altered.
- Suggestion loading, section queued state, per-section errors, version history.
- Readiness gating: Publish only when `readiness.ready`; owner/session/stale-state guards disable writes.
- MemberAccess phases: loading → login → profile status → explicit legal acceptance → ready.
- Edit route load error with `PageError` retry and conflict reload.

## Responsive and accessibility

`max-w-3xl` page with 12px phone padding and 24px desktop padding; one `max-w-2xl` card with 20px phone / 40px desktop inner padding. All controls and stepper buttons are at least 48px tall. Step panels use `hidden` rather than unmounting, so preserve field values and focus. Optional groups use native `<details>` and must remain keyboard reachable. Status panels use `role="status"` or `role="alert"`. Legal acceptance and privacy decisions must remain explicit and keyboard-reachable.

## Source crosswalk

`CreateCampaign.jsx` · `EditCampaign.jsx` · `campaignWizard.js` · `CampaignComposer` · `CampaignVoiceInput.jsx` · `CampaignVoiceGuide.jsx` · `CampaignImageChoices.jsx` · `exactArtworkCaption.mjs` · `supportNeeds.mjs` · `campaignLifecycle.js` · `CampaignTemplatePreview.jsx` · `CampaignReadinessScore` · `PrepublicationGate.jsx` · `CampaignDocuments.jsx` · `AgentAdviceReview.jsx` · `WritingDraftReview.jsx` · `CampaignLocationFields.jsx` · `MemberAccess.jsx` · `index.css` · `styles-ifund-studio.css` · `styles-cosmic-refinement.css` · `worker/imageStudio.js`.

## Stitch variation guidance

Vary stepper styling, panel density, preview framing, eclipse illustration, caption-field treatment, and suggestion-card layout. Do not hide privacy/storage warnings, auto-accept legal terms, publish without readiness, make support required, infer a cash goal from an unanswered selector, let a model redraw caption spelling, fabricate campaign metrics, treat AI suggestions as verified facts, or remove AI-artwork provenance. The external handoff remains a direct-to-provider link, not an iFund checkout.

9. **Separate media creative styles (not campaign-cover defaults).** The Growth Studio media generator keeps selectable Interstellar, Futuristic, Cyberpunk, Comic, IFund signature, and **Hyper-realistic simulated event**. The last is only a fictional/synthetic-event visualization, must be disclosed as AI-simulated, and is not the standard campaign-cover style. Future Stitch/Muse redesigns must not reintroduce split cover-style selection.
