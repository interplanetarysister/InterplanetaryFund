# Campaign creator

**Routes:** `/create` (capture `?manual=1`), `/campaigns/:id/edit`, `/templates`  
**Owners:** `apps/web/src/pages/CreateCampaign.jsx`, `EditCampaign.jsx`, `CampaignTemplates.jsx`  
**Shell:** Inside `Layout`. `GlobalAgentCompanion` supplies the floating account and Ask IFund controls and the one-time page guide; `QuickActions` remains bottom-left.
**Capture:** @html/campaign-creator-desktop.html, @html/campaign-creator-mobile.html, @screenshots/campaign-creator-desktop.png, @screenshots/campaign-creator-mobile.png. Captured in the guest manual-entry render state; no draft was saved and the signed-in tour is not present.

## Purpose

The creator is a guided writing and launch workspace, not a marketing page. It helps an owner describe a real fundraiser, review AI-assisted suggestions critically, preview the public page, and only then save or publish. Privacy and ownership warnings are part of the interface.

## Component topology

`CreateCampaign` param gate → `NewCampaign` session phase → `CampaignEntry` private-setup recovery → `CampaignComposer` keyed by `(draft|new):(owner|guest)`. Private drafts and edits are wrapped in `MemberAccess`; guest drafting is browser-only.

Supporting surfaces: `ExternalCampaignHandoff`, `CampaignDocuments`, `AgentAdviceReview`, `WritingDraftReview`, `CampaignLocationFields`, `AgentFeatureLauncher`, `CampaignTemplatePreview`, `CampaignReadinessScore`, `PrepublicationGate`, `PrelaunchNotice`, `PageError`.

## Section order and anatomy

1. **Compact header.** `font-display text-xl` "New Campaign" with the `{step+1} / 3` counter. A template, when supplied, appears as a small `role="status"` line; persistent My campaigns and fundraising-partner links are no longer in the header.
2. **Three-icon stepper.** `WIZARD_STEPS = ["Campaign basics", "Your story", "Review and publish"]` rendered as a centered `grid grid-cols-3` of 56px icon buttons (`Target`, `BookOpen`, `Rocket`). Each button has `title`, `aria-label="Step N: …"`, and `aria-current="step"`; future steps are disabled.
3. **Collapsed optional agent help.** `AgentFeatureLauncher` sits inside `<details>` labelled "More agent help (optional)". Draft, privacy, storage, and handoff notices remain visible when active.
4. **Step 0 — Tell us what matters.** The main cosmic panel is `max-w-2xl rounded-3xl` with a cyan border. It contains a working title, collapsed "Campaign type (optional)" radios, a short "What are we making possible?" textarea, `CampaignVoiceInput` with "Talk instead" / "Hear the question", "Who or what is this for?", tone, and a collapsed "A little more context (optional)" group. `ExternalCampaignHandoff` remains collapsed under "Already fundraising somewhere else? (optional)".
5. **Step 1 — Campaign writing assistant.** "Generate campaign ideas"; title ideas, short descriptions, story idea, no-image illustration concept; per-section editing with Regenerate / Accept / Discard; version history in `<details>`. `AgentAdviceReview` is collapsed under "More writing help (optional)", while `WritingDraftReview` and `CampaignDocuments` remain available.
6. **Step 2 — Launch review.** A factual review of the owner's current words, Desktop/Mobile `CampaignTemplatePreview` in a collapsed panel, a readiness list, and explicit copy that publishing requires neither AI review nor a story-length target.
7. **Persistent form.** `#campaign-editor` with title, short description, story, category, goal, cover upload/URL/preview, end date, private location note, and `CampaignLocationFields`.
8. **Actions and footer navigation.** Save draft / Publish campaign controls in the launch panel; Back / Continue / Save private draft in the footer with explicit busy labels.

Editor route adds status pill, `CampaignDocuments`, `CampaignReadinessScore`, `PrepublicationGate`, Pause/Publish/View public actions, and hash deep-links `#campaign-title|summary|story|goal|atlas-location`.

## Visual tokens

- Root: `mx-auto max-w-3xl space-y-6 px-4 py-8`.
- Writing panel: `.ifund-cosmic-panel.mx-auto.max-w-2xl.space-y-4.rounded-3xl.border.border-cyan-400/20.bg-card.p-5.shadow-xl.sm:p-8`.
- Standard panels: `.ifund-cosmic-panel.rounded-2xl.border.border-border.bg-card.p-5.sm:p-8`.
- Inputs: `mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4`; textareas `rounded-xl p-4`; focus ring cyan.
- Cover preview: `max-h-56 rounded-lg object-contain`.
- Stepper: centered 3-column grid of 56px rounded icon buttons; active step uses indigo fill and cyan border, future steps are dimmed and disabled.
- Actions: 48px minimum, `rounded-xl`, 20–24px horizontal padding; disabled `opacity-50`.
- Legacy `.campaign-quest` styles exist in `index.css` but are not used by the current creator markup; do not reintroduce them as the primary visual language.

## States to preserve

- Session loading ("Opening your campaign editor…"), draft loading, draft load error, wizard error, progress notice.
- Browser storage unreadable block with retry.
- Guest-draft import choice and cleanup retry.
- Autosave error with retained private browser copy warning.
- Upload validation: JPG/PNG/WebP/AVIF, 5 MB limit; upload progress and receipt.
- Voice input: unavailable browser, permission failure, "Listening…", stop, and spoken text appended after the current value without overwriting typing; talkback unsupported state.
- Suggestion loading, section queued state, per-section errors, version history.
- Readiness gating: Publish only when `readiness.ready`; owner/session/stale-state guards disable writes.
- MemberAccess phases: loading → login → profile status → explicit legal acceptance → ready.
- Edit route load error with `PageError` retry and conflict reload.

## Responsive and accessibility

`max-w-3xl` with 16px phone padding; writing panel 20px mobile / 32px desktop; form grids 1→2→3 columns; all controls at least 48px except the 56px icon stepper. Step changes use `hidden` rather than unmounting, so preserve field values and focus. Optional groups use native `<details>` and must remain keyboard reachable. Status panels use `role="status"` or `role="alert"`. Legal acceptance and privacy decisions must remain explicit and keyboard-reachable.

## Source crosswalk

`CreateCampaign.jsx` · `EditCampaign.jsx` · `campaignWizard.js` · `CampaignComposer` · `CampaignVoiceInput.jsx` · `CampaignTemplatePreview.jsx` · `CampaignReadinessScore` · `PrepublicationGate.jsx` · `CampaignDocuments.jsx` · `AgentAdviceReview.jsx` · `WritingDraftReview.jsx` · `CampaignLocationFields.jsx` · `MemberAccess.jsx` · `index.css` · `styles-ifund-studio.css`.

## Stitch variation guidance

Vary stepper styling, panel density, preview framing, and suggestion-card layout. Do not hide privacy/storage warnings, auto-accept legal terms, publish without readiness, fabricate campaign metrics, or treat AI suggestions as verified facts. The external handoff remains a direct-to-provider link, not an iFund checkout.
