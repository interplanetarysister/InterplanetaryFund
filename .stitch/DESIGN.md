---
version: alpha
name: Interplanetary Fund — Unified Cosmic Fundraising
description: >
  Source-extracted design system for the canonical apps/web React/Vite frontend.
  It captures the current shipped visual language so Stitch can generate new
  screens without replacing components, changing authorization, or touching
  payments. Tokens are normative; prose explains intent and application.
colors:
  primary: "#2474F5"
  action: "#1D4ED8"
  secondary: "#4EBFF0"
  tertiary: "#A694F5"
  neutral: "#1F2937"
  surface: "#F8FAFC"
  onSurface: "#1F2937"
  error: "#EF4444"
  light:
    background: "#F8FAFC"
    foreground: "#1F2937"
    card: "#FFFFFF"
    cardForeground: "#1F2937"
    primary: "#2474F5"
    primaryForeground: "#FFFFFF"
    secondary: "#F1F4F9"
    secondaryForeground: "#182239"
    muted: "#F1F4F9"
    mutedForeground: "#65738B"
    border: "#E1E7EF"
    input: "#E1E7EF"
    ring: "#2474F5"
    destructive: "#EF4444"
    destructiveForeground: "#FAFAFA"
  dark:
    background: "#0A0D1A"
    foreground: "#F8FAFC"
    card: "#1A222E"
    cardForeground: "#F8FAFC"
    primary: "#0DA2E7"
    primaryForeground: "#FFFFFF"
    secondary: "#253141"
    secondaryForeground: "#F8FAFC"
    muted: "#253141"
    mutedForeground: "#B1C0D2"
    border: "#2C3A4E"
    input: "#2C3A4E"
    ring: "#0DA2E7"
    destructive: "#7F1D1D"
    destructiveForeground: "#FAFAFA"
  studio:
    surface: "#FFFFFF"
    ink: "#132136"
    sky: "#1768BF"
    orbit: "#5B49B8"
    copper: "#C59153"
    outline: "#C4D2E2"
    darkSurface: "#162239"
    darkInk: "#EBF3FD"
    darkSky: "#4EBFF0"
    darkOrbit: "#A694F5"
    darkOutline: "#4D617B"
  cosmic:
    aurora: "#47E0EE"
    orbitPurple: "#A88FFF"
    deepInk: "#071123"
    mint: "#6EF1E7"
    cyan: "#88F2EB"
    teal: "#63E8DC"
    panelTop: "#0B1424"
    panelBottom: "#111B30"
    consoleTop: "#0F1F37"
    consoleBottom: "#08101F"
    symmetryCyan: "#28E8FF"
    symmetryBlue: "#7688FF"
    symmetryPink: "#FF69DE"
    symmetryMint: "#6EFFBB"
    eclipseSky: "#253866"
    eclipseHalo: "#A8F4FF"
    eclipseUmbra: "#050813"
  agent:
    nexus: "#DCE3EB"
    echo: "#409EFF"
    pulse: "#4DE2DB"
    orbit: "#39D6A0"
    polaris: "#A98BFF"
    forge: "#FFB35B"
    link: "#8294FF"
    story: "#F5B5D3"
    discover: "#9DE3FF"
typography:
  headline-display:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, sans-serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -2px
  headline-lg:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 760
    lineHeight: 1.15
    letterSpacing: -1.5px
  headline-md:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 710
    lineHeight: 1.25
    letterSpacing: -0.8px
  body-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  label-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  eyebrow:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 10px
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: 2px
rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 21px
  "2xl": 24px
  "3xl": 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  "2xl": 32px
  section: 56px
  shellRail: 76px
  touch: 44px
  touchLarge: 48px
motion:
  state-change:
    duration: 180ms
    delay: 0ms
    timingFunction: ease
  surface-enter:
    duration: 250ms
    delay: 0ms
    timingFunction: ease-out
  surface-exit:
    duration: 250ms
    delay: 0ms
    timingFunction: ease-out
  route-transition:
    duration: 250ms
    delay: 0ms
    timingFunction: cubic-bezier(0.4, 0, 0.2, 1)
  progress-spin:
    duration: 900ms
    delay: 0ms
    timingFunction: linear
  symmetry-drift:
    duration: 22000ms
    delay: 0ms
    timingFunction: ease-in-out
  eclipse-glimmer:
    duration: 17000ms
    delay: 0ms
    timingFunction: ease-in-out
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.light.primaryForeground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 48px
  button-ghost:
    backgroundColor: "#FFFFFF12"
    textColor: "{colors.light.foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 44px
  prompt-composer:
    backgroundColor: "#0F172A"
    textColor: "#FFFFFF"
    typography: "{typography.body-md}"
    rounded: "{rounded.2xl}"
    padding: 16px
    height: 168px
  cosmic-panel:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.2xl}"
    padding: 32px
  agent-card:
    backgroundColor: "{colors.cosmic.panelTop}"
    textColor: "#EFF6FF"
    typography: "{typography.label-md}"
    rounded: "{rounded.xl}"
    padding: 21px
    height: 168px
  side-panel:
    backgroundColor: "#090F1E"
    textColor: "#EFF6FF"
    typography: "{typography.body-sm}"
    rounded: 0px
    padding: 14px
    width: 520px
  voice-guide:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    borderColor: "rgb(34 211 238 / .35)"
  support-selector:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px
  artwork-choice:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 16px
    borderColor: "rgb(34 211 238 / .30)"
  exact-caption-input:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  eclipse-review-panel:
    backgroundColor: "{colors.cosmic.deepInk}"
    textColor: "#F4F8FF"
    typography: "{typography.body-md}"
    rounded: 28.8px
    padding: 32px
---

# Interplanetary Fund — Unified Cosmic Fundraising

## Overview

Interplanetary Fund should feel like a calm mission-control desk for ambitious fundraisers: editorial confidence at the front door, a spacious and legible private workspace after sign-in, and a focused advisory layer when a member invites an AI specialist into the flow. The brand is "Interplanetary Fund" with the Slogan "What If?" and the positioning line "The Universal Fundraising Operating System."

The current visual language is a **restrained cosmic modernism** System: deep navy/ink fields, cyan-to-blue-to-violet gradients, soft orbital geometry, and light, paper-like work surfaces. The space imagery is atmospheric rather than decorative noise; it supports the story without competing with forms, financial facts, or consent language.

Three rules govern every generated screen:

1. **Trust before spectacle.** Campaign facts, verified totals, permissions, and payment status must be unmistakable. Never invent donations, receipts, supporter counts, provider grants, or causal fundraising claims.
2. **One system, four surfaces.** Public marketing, private dashboard, campaign editor, and agent advisory chrome share tokens and interaction anatomy, but they do not collapse into one template. See @references/homepage.md#homepage, @references/dashboard.md#dashboard, @references/campaign-creator.md#campaign-creator, and @references/agent-chat.md#agent-chat.
3. **Cosmetic only.** The cosmic layer must never restyle hosted payment widgets, alter consent, change ownership, or imply that an advisory answer performed an external action.

Native/mobile-review styling in `apps/web/src/mobile.css` is a separate review target and is not part of this canonical website design system.

## Colors

The palette uses a light workspace default with dark cosmic surfaces for navigation, hero moments, and advisory panels. `primary` is the action blue used for the single most important action on a view; `secondary` and `tertiary` are accents, not competing call-to-action colors.

- **Primary (#2474F5 light / #0DA2E7 dark):** action, links, focus, selected states as shipped. Used for one dominant next step.
- **Accessible action (#1D4ED8):** proposed CTA fill for generated concepts because white on the shipped light primary measures 4.29:1, below WCAG AA 4.5:1. Keep the source token for fidelity, but use this action token for new primary buttons until the shipped CTA contrast is repaired.
- **Secondary (#4EBFF0):** cyan accent that carries the "aurora" signature and prompt emphasis.
- **Tertiary (#A694F5):** orbit purple for ambient gradients and selected specialist surfaces.
- **Surface (#F8FAFC light / #0A0D1A dark):** page field. Cards use `#FFFFFF` or `#1A222E` so they lift without heavy borders.
- **Deep ink (#071123):** reserved for hero fields, sidebar, agent panel, and console surfaces.
- **Mint (#6EF1E7):** agent-team emphasis and high-contrast focus accents.
- **Symmetry gradient (#28E8FF → #7688FF → #FF69DE → #6EFFBB):** the local `cosmic-symmetry.svg` geometry layered behind public and workspace surfaces at low opacity; it is atmosphere, never a status or CTA signal.
- **Eclipse palette (#253866 halo sky, #A8F4FF ring, #050813 umbra):** reserved for the step-three launch-review moment in `cosmic-eclipse.svg`. Keep its caption text above `#D5E9FF` for contrast.
- **Copper (#C59153):** a rare warmth accent for editorial moments; do not use for status or primary actions.
- **Error (#EF4444 light / #7F1D1D dark):** destructive or blocked states only; pair with text, never color alone.

Theme tokens are HSL-triplet variables in `src/index.css`; the YAML above records their resolved sRGB values for Stitch. Studio RGB triplets in `src/styles-ifund-studio.css` and cosmic hex constants in `src/styles/ifund-next-cosmic.css` remain separately named because they drive distinct surfaces.

Use `colors.agent.*` only for the nine agent identity glyphs and per-card accent rules. DISCOVER is consolidated into LINK in the current specialist grid, but its identity token remains for historical and shared-context displays.

## Typography

Inter and Space Grotesk are both locally bundled in `apps/web/public/fonts/`, and the Space Grotesk SIL OFL 1.1 license is distributed alongside its upstream font file. No external font service is required. Orbital Display remains blocked until its exact font license and provenance are confirmed. Orbital Display is not loaded, bundled, or distributed until its exact license and provenance are confirmed.

- **Marketing display (license-gated):** Orbital Display is approved in concept ONLY for the marketing hero and major promotional headlines. The exact foundry, web/mobile embedding terms, and usable licensed files remain unverified. Do not bundle, load, or ship the font; Space Grotesk is the safe current fallback.
- **Headings:** Space Grotesk for page and section headings, with 32px desktop / 28px phone for page headings and 24px desktop / 22px phone for sections.
- **Body and interface:** Inter for paragraphs, nav/sidebar items, buttons, agent conversations, forms, checkout, withdrawals, analytics, figures, and metadata; 16px body, 14px secondary and 13px captions.
- **Mono:** system monospace only for technical identifiers or receipts, never for primary copy.

Hierarchy should be established through size, weight, and spacing before color. On small screens the marketing headline steps down from 56px to 36px, body text remains 16px, and touch targets remain at least 44px. Headings scale 32px/28px and sections 24px/22px. Eyebrows use uppercase, wide tracking, and a short rule or dot; they never replace a real heading.

Avoid more than two font families in one screen (headings + body, with the licensed Orbital Display as a future, marketing-only brand exception). Avoid sentence-case marketing shouts and mixed underline styles.

## Layout

The shell is a desktop rail plus scrollable workspace, and a sticky mobile header plus fixed bottom navigation. The homepage is the exception: it owns its public mobile chrome and footer and is not wrapped in the main `Layout`.

- Desktop rail: dark navy gradient, 44px minimum nav links, cyan active state with inset bar; workspace bar is 76px tall with a soft translucent surface.
- Content max widths: `max-w-3xl` for focused editor/forms, `max-w-6xl` for homepage sections, `max-w-7xl` for dashboard, 1180px for the AI Team page.
- Content padding: 16px on phones, 24–32px from `sm` upward; safe-area bottom padding on mobile.
- Grids: campaign cards 1 → 2 → 3 columns; dashboard shortcuts 2 → 4; agent cards 2 → 3 → 4 → 1 at 390px; creator stepper 1 → 3.
- Prompt composer: centered, max 576–640px, 104px minimum textarea, 48px submit.
- Persistent agent panel: inline docked `clamp(335px, 36vw, 520px)` on desktop; below 767px it becomes a right sheet `min(100vw, 480px)` with focus trap, Escape close, and body scroll lock.
- Breakpoints to preserve: 390, 420, 640, 767, 800, 1000, and 1023px. At 390px collapse complex grids to one column and tighten card padding without shrinking touch targets below 44px.

Whitespace is generous but purposeful: 24px between related cards, 56px between major marketing sections, and restrained border radii that keep surfaces friendly without becoming playful.

## Elevation & Depth

Depth comes from layered translucent surfaces, not heavy drop shadows.

- Cosmic panels: subtle purple/cyan radial gradients over a card surface, 1px low-opacity border, soft 11–26px shadows.
- Hero fields: large radial aurora gradients plus faint orbit rings or dot grids; pseudo-elements sit behind content and never intercept pointer events.
- Symmetry geometry: `cosmic-symmetry.svg` is tiled at `clamp(350px,54vw,640px)` behind scrollable workspace/public surfaces and at 410px on phones; its drift is 22px or less and stops under reduced motion and print.
- Eclipse review: `.ifund-eclipse-moment` uses `cosmic-eclipse.svg` cover over `#080D22`, an inset cyan border, and a soft outer shadow. Direct children receive `position: relative` so owner text stays above the artwork.
- Dashboard modules: near-white gradient in light mode, midnight-to-purple gradient in dark; 1.45rem radius and a soft 37px shadow.
- Agent cards: vertical gradient from `#0B1424` to `#111B30`, top accent rule, and a single orbit arc.
- Focus: 3px aurora outline with 3px offset on first-party controls; high-contrast mode increases outline width to 4px.
- Hosted payment widgets keep their provider-controlled elevation and must not be overridden.

## Shapes

Rounded rectangles dominate: 12px controls, 14px base radius, 21px modules/cards, 24–28px hero and console surfaces, and fully rounded pills/chips. Do not mix sharp corners with the cosmic system.

Icons are Lucide line icons at 16–24px in normal UI, 40px on dashboard specialist cards, and 70px on the AI Team specialist grid. Agent identities use custom SVG glyphs in `AgentIdentityIcon.jsx` with the `colors.agent.*` accents. Decorative orbit ellipses and dot grids are background-only; keep them at low opacity and mask them away from dense text.

Illustration should stay abstract: planets, orbital paths, stars, soft auroras, and editorial photography with respectful human subjects when added later. Avoid stock-photo fundraising stereotypes, fake donation tickers, and provider logos used as endorsements.

## Motion & Micro-interaction

Motion is brief and functional. Buttons lift 1px on hover and settle on active; cosmic panels transition border/shadow over 180–250ms; route transitions fade and slide 100% over 250ms with reduced-motion neutralized.

Loading controls expose a spinner via `data-loading="true"` and become non-interactive. Voice/dictation, AI "queued" states, and session checks must always show textual status in addition to any animation. Background symmetry drifts over 22 seconds; the eclipse review caption uses a separate 17-second glimmer. Buttons lift 1.5px and settle with a 0.97 active scale in 170ms.

Respect `prefers-reduced-motion: reduce` in every generated surface: no route slide, no hover transform, no spinning progress affordance, and instant scroll behavior. Respect `prefers-contrast: more` by widening focus outlines. Never animate money amounts, consent checkboxes, or provider status as if they were celebratory.

## Voice & Content Strategy

Write as a capable mission partner, not a hype machine. The voice is warm, plain-spoken, and evidence-labeled.

- Use "What if?" as a brand invitation, then move immediately to concrete next steps.
- Say "private by default," "advisory only," "verified totals only," and "review before publishing" where those conditions actually apply.
- Distinguish provider-verified donations, owner-reported estimates, sandbox results, and unverified planning previews in the same sentence when they appear together.
- AI copy must never claim it posted, paid, published, emailed, transferred money, or secured an external provider grant. Those actions require separate authorization and verified receipts.
- Spoken navigation is advisory and local: member-only commands open secure sign-in first, and the assistant says plainly that no account action or outside post occurred. Never ask for a password or verification code in chat or voice.
- Support type is optional and defaults to "Not sure yet". Money is one of twelve needs; never infer a cash goal, dollar amount, or fabricated support summary from an unanswered selector.
- Generated campaign artwork is illustrative, not documentary evidence. Preserve its provenance on the public cover and label it "AI-generated illustration" where shown. Optional words on the image must be the owner's exact text rendered locally after generation; never let the image model redraw or "improve" spelling.
- form labels should name the field directly; helper text explains consequence, not urgency. Error messages identify what happened and the safe recovery step.
- Financial, legal, permission, and cancellation language stays literal. Do not soften a failed closed state into a success.

Captured fixtures must remain synthetic or source-derived. The local captures deliberately contain no signed-in financial data, payment receipts, or provider grants.

## Components

Reusable anatomy is documented in the component sticker sheet @components/sticker-sheet.html. Rendered references include @html/homepage-desktop.html, @html/dashboard-desktop.html, @html/campaign-creator-desktop.html, and @html/agent-chat-desktop.html.

**Buttons and links.** Primary actions use cyan-to-blue or blue fill with 48px height, 12–14px radius, and a single dominant action per view. Secondary actions use translucent white or outlined surfaces. Icon-only controls remain 44px square with accessible names.

**Prompt composer.** A dark rounded card with an eyebrow, textarea, helper note, and gradient send button. The hero variant uses `bg-slate-950/80`, cyan border, and white text; the panel variant uses `bg-card` and theme foreground. Ctrl/Cmd+Enter submits. Keep the note about private-by-default drafting visible.

**Cards and panels.** `.ifund-cosmic-panel` is the shared card surface for creator sections, how-it-works steps, and readiness lists. Campaign cards use image, category chip, title, succinct description, and verified/progress metadata only. Dashboard stat tiles use a 2–3 column grid and never imply a financial total unless the value is provider-verified.

**Navigation.** Desktop sidebar active state uses cyan text and an inset cyan bar. Mobile bottom tabs use a top gradient indicator. A persistent Log in / Account launcher sits near the bottom-right on every route. The "Ask IFund" launcher is adjacent to it on every route except the exact homepage, where agent chrome is deliberately hidden; on phones both controls move above the bottom nav while `QuickActions` remains bottom-left.

**Inputs and forms.** 16px minimum font on mobile to avoid iOS zoom, 48px minimum height, 12px radius, cyan focus ring, and labels adjacent to fields. Validation and readiness lists sit beside the action they gate rather than in a detached toast.

**Agent panel.** Header with identity/close, horizontally scrollable switcher, message log with `role="log"` and `aria-live="polite"`, availability status, voice controls, textarea, and "Open full workspace." User bubbles are cyan/blue; answers are dark slate. Direct answers are advisory and gated by deployment, membership, saved permission, and verified session state.

**Wizard stepper.** Three compact steps — Campaign basics, Your story, Review and publish — supply accessible button labels for the centered grid of `Target`, `BookOpen`, and `Rocket` icons. Buttons are at least 48px tall, future steps are disabled, and panels are toggled with `hidden` rather than unmounted so field values and focus context survive. The visible step headings are "Your idea", "Your story", and "Ready to share".

**Voice guide and support selector.** The optional NEXUS walkthrough lives in a disclosure labelled "Talk through it with NEXUS (optional)" with the visible sub-label "Have NEXUS guide me by voice (optional)". It shows Quick setup / Detailed guidance choices and text-labeled Answer by voice / Hear question / Skip controls; spoken answers populate editable draft fields only. The support selector begins at "Not sure yet", lists twelve plain-language needs, and shows the chosen option's examples without assigning a value or cash goal. See @references/campaign-creator.md#campaign-creator and @references/what-if.md#what-if-private-mission-entry.

**Original artwork and eclipse review.** Step two keeps artwork in a collapsed "Add photo or illustration (optional)" disclosure with four styles, an optional exact-words field with a "Use campaign title exactly" action, prerequisite copy, a reviewable preview, and a provenance notice. The image model draws without lettering; iFund overlays the owner's text in a regular font and never machine-corrects its spelling. Never make a generated illustration look like a verified photograph. Step three places the factual review above the local eclipse artwork with the exact caption "Review it, then decide when to publish." and no invented progress or receipts. See @components/sticker-sheet.html#voice-guide, @components/sticker-sheet.html#exact-caption-input, and @components/sticker-sheet.html#eclipse-review-panel.

**Sign-in voice entry.** The secure auth card may offer "Use NEXUS voice navigation" in a cyan callout, followed by explicit "never speak passwords or codes" guidance. It opens the same advisory panel; it does not replace the credential form. See @references/auth-voice.md#secure-sign-in-and-nexus-voice-entry.

### Design System Notes for Stitch Generation

When generating new concepts, start from these tokens and the closest reference file; do not ask Stitch to rewrite source components. Preserve section order, accessible roles, and all state copy from the references. Generate *variations* in spacing, hierarchy, illustration, and polish while keeping the token names and legal/advisory language intact. If a new component is needed, add it to the sticker sheet with a `<!-- COMPONENT: name -->` marker and reference it from this section.

No Stitch MCP server or upload tool is configured in this build session. This file and the captured references are local inputs only; no Stitch project, branch, preview, or production deployment was modified.

## Do's and Don'ts

- Do use the primary color for the single most important action per screen.
- Do keep 44px minimum touch targets and visible 3px focus outlines.
- Do preserve light and dark variants, reduced-motion behavior, and high-contrast rules.
- Do label unverified, reported, sandbox, and provider-verified information differently.
- Do keep support optional, default it to "Not sure yet", and preserve AI-artwork provenance.
- Do keep the public/page shell, dashboard shell, editor shell, and advisory panel visually related but functionally distinct.
- Don't restyle hosted payment widgets or imply that a source-level design change activated billing or withdrawals.
- Don't use agent identity colors as general category colors or make DISCOVER appear as a separate active specialist in the current grid.
- Don't fabricate supporter counts, donations, payout receipts, OAuth grants, or campaign outcomes.
- Don't turn spoken navigation into an account action, infer money from an unanswered support selector, or label generated art as a documentary photograph.
- Don't hide consent, permission, cancellation, or error states behind visual polish.
- Don't replace the existing components in a Stitch output; treat Stitch as a design-reference and variation generator until explicit source acceptance.
