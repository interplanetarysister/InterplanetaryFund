# Campaign creator

**Routes:** `/create` (capture `?manual=1`), `/campaigns/:id/edit`, `/templates`  
**Owners:** `apps/web/src/pages/CreateCampaign.jsx`, `EditCampaign.jsx`, `CampaignTemplates.jsx`  
**Shell:** Inside `Layout`.  
**Capture:** @html/campaign-creator-desktop.html, @html/campaign-creator-mobile.html, @screenshots/campaign-creator-desktop.png, @screenshots/campaign-creator-mobile.png. Captured in the guest manual-entry render state; no draft was saved.

## Purpose

The creator is a guided writing and launch workspace, not a marketing page. It helps an owner describe a real fundraiser, review AI-assisted suggestions critically, preview the public page, and only then save or publish. Privacy and ownership warnings are part of the interface.

## Component topology

`CreateCampaign` param gate → `NewCampaign` session phase → `CampaignEntry` private-setup recovery → `CampaignComposer` keyed by `(draft|new):(owner|guest)`. Private drafts and edits are wrapped in `MemberAccess`; guest drafting is browser-only.

Supporting surfaces: `ExternalCampaignHandoff`, `CampaignDocuments`, `AgentAdviceReview`, `WritingDraftReview`, `CampaignLocationFields`, `AgentFeatureLauncher`, `CampaignTemplatePreview`, `CampaignReadinessScore`, `PrepublicationGate`, `PrelaunchNotice`, `PageError`.

## Section order and anatomy

1. **Header.** "Create a campaign · {step}" in `font-display text-3xl`, links to My campaigns and fundraising partners.
2. **Stepper.** `WIZARD_STEPS = ["Campaign basics", "Your story", "Review and publish"]`; `<ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">`, `aria-current="step"`, 48px buttons, active `border-primary bg-primary/10`.
3. **AgentFeatureLauncher and notices.** Warning/status panels for guest mode, draft recovery, privacy, storage, and handoff decisions.
4. **Step 0 — Campaign basics.** Working title, `CAMPAIGN_WRITING_PATHS` radios, details/beneficiary/need, tone, and "Facts or wording to preserve". `ExternalCampaignHandoff` appears here.
5. **Step 1 — Campaign writing assistant.** "Generate campaign ideas"; title ideas, short descriptions, story idea, no-image illustration concept; per-section story editing with Regenerate / Accept / Discard; version history in `<details>`; `WritingDraftReview` and `AgentAdviceReview`.
6. **Step 2 — Launch review.** "Before you publish" / "Ready to publish" readiness list, Desktop/Mobile `CampaignTemplatePreview`, Save and Publish actions.
7. **Persistent form.** `#campaign-editor` with title, short description, story, category, goal, cover upload/URL/preview, end date, private location note, and `CampaignLocationFields`.
8. **Footer navigation.** Back / Continue / Save private draft with explicit busy labels.

Editor route adds status pill, `CampaignDocuments`, `CampaignReadinessScore`, `PrepublicationGate`, Pause/Publish/View public actions, and hash deep-links `#campaign-title|summary|story|goal|atlas-location`.

## Visual tokens

- Root: `mx-auto max-w-3xl space-y-6 px-4 py-8`.
- Panels: `.ifund-cosmic-panel.space-y-4.rounded-2xl.border.border-border.bg-card.p-5.sm:p-8`.
- Inputs: `mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4`; textareas `rounded-xl p-4`; focus ring cyan.
- Cover preview: `max-h-56 rounded-lg object-contain`.
- Stepper: 1 column mobile, 3 from `sm`; active step uses primary tint.
- Actions: 48px, `rounded-xl`, 24px horizontal padding; disabled `opacity-50`.
- Legacy `.campaign-quest` styles exist in `index.css` but are not used by the current creator markup; do not reintroduce them as the primary visual language.

## States to preserve

- Session loading ("Opening your campaign editor…"), draft loading, draft load error, wizard error, progress notice.
- Browser storage unreadable block with retry.
- Guest-draft import choice and cleanup retry.
- Autosave error with retained private browser copy warning.
- Upload validation: JPG/PNG/WebP/AVIF, 5 MB limit; upload progress and receipt.
- Suggestion loading, section queued state, per-section errors, version history.
- Readiness gating: Publish only when `readiness.ready`; owner/session/stale-state guards disable writes.
- MemberAccess phases: loading → login → profile status → explicit legal acceptance → ready.
- Edit route load error with `PageError` retry and conflict reload.

## Responsive and accessibility

`max-w-3xl` with 16px phone padding; panels 20px mobile / 32px desktop; form grids 1→2→3 columns; all controls 48px. Step changes use `hidden` rather than unmounting, so preserve field values and focus. Status panels use `role="status"` or `role="alert"`. Legal acceptance and privacy decisions must remain explicit and keyboard-reachable.

## Source crosswalk

`CreateCampaign.jsx` · `EditCampaign.jsx` · `campaignWizard.js` · `CampaignComposer` · `CampaignTemplatePreview.jsx` · `CampaignReadinessScore` · `PrepublicationGate.jsx` · `CampaignDocuments.jsx` · `AgentAdviceReview.jsx` · `WritingDraftReview.jsx` · `CampaignLocationFields.jsx` · `MemberAccess.jsx` · `index.css` · `styles-ifund-studio.css`.

## Stitch variation guidance

Vary stepper styling, panel density, preview framing, and suggestion-card layout. Do not hide privacy/storage warnings, auto-accept legal terms, publish without readiness, fabricate campaign metrics, or treat AI suggestions as verified facts. The external handoff remains a direct-to-provider link, not an iFund checkout.
