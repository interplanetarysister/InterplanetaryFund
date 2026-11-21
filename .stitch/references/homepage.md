# Homepage

**Route:** `/`  
**Owner:** `apps/web/src/pages/Home.jsx`  
**Shell:** Public page, deliberately outside `Layout`; `GlobalAgentCompanion` still wraps the route and the fixed "Ask IFund" launcher is present.  
**Capture:** @html/homepage-desktop.html, @html/homepage-mobile.html, @screenshots/homepage-desktop.png, @screenshots/homepage-mobile.png. Captured unauthenticated at 1365×900 and 390×844.

## Purpose

The homepage is the invitation: one memorable brand promise, one immediate prompt, and clear paths into discovery, campaign creation, and platform information. It should feel expansive and editorial, but the next action must be obvious within one viewport.

## Section order and anatomy

1. **Public chrome.** `.ifund-public` with cosmic radial gradients, `MobileBottomNav`, `QuickActions`, and `PrelaunchNotice` when public fundraising is disabled. Bottom padding reserves `calc(4.5rem + env(safe-area-inset-bottom))` on mobile.
2. **Hero.** `.ifund-public-hero.deep-space` with archived planet image `/images/base44-archive/19cbf6ba785409de9ac0.png` at 60% opacity and a graceful image-error fallback. Centered `max-w-3xl` content:
   - `.ifund-editorial-eyebrow` — "A universe of possibility"
   - `BrandLogo`
   - `h1.ifund-home-headline.font-display` — "What if?" with `.brand-gradient-text` on the question
   - short supporting lede
   - `PromptComposer variant="hero"` (`max-w-xl`, 1500-character limit, "We'll fill in your draft…")
   - auth-dependent CTA row: `/dashboard` for members; `/create?manual=1` and `/discover` for guests
   - "Get the IFund app" and sign-in/register links
3. **"Be here from the beginning" signup card.** A compact support/identity moment inside the hero region; keep it secondary to the prompt.
4. **Categories.** `CampaignCategoryGrid` links to `/discover?category=…`; six visible categories in 1/2/3 columns with `.ifund-tap.ifund-cosmic-panel` cards.
5. **Featured campaigns.** Rendered only when active campaigns load; `CampaignCard` grid in 1/2/3 columns. Keep funding labels fact-based and source-labeled.
6. **How it works.** `.ifund-cosmic-panel.rounded-3xl` with three steps and Lucide icons `Wand2`, `LayoutTemplate`, `ShieldCheck`; CTAs "Start free" and "See plans".
7. **About / story.** `.ifund-story-surface`, `max-w-3xl`. Always-visible `OPENING` paragraphs; `STORY` revealed by "Read more · Our Story" / "Show less" with `aria-expanded`.
8. **Platform support + legal footer.** `PayPalDonateButton` card for platform support, followed by `LegalFooter`.

## Visual tokens

- Hero: deep ink `#071123` base, cyan/blue/violet gradient text, low-opacity planet photography, thin `rgb(107 159 247 / .16)` bottom border.
- Page field: light cosmic gradient `#EDF7FF → #F8F3FF → #ECF9FB`; dark variant `#060D23 → #161435 → #091B31`.
- Cards: `.ifund-cosmic-panel`, 24px radius, 1px border, soft radial tint, 44px minimum tap height.
- Buttons: primary cyan→blue gradient, `min-h-12`, `rounded-xl`, `shadow-lg shadow-blue-500/25`; secondary `border-white/20 bg-white/5`.
- Type: Fraunces display 36px mobile / 60px desktop; body Inter 15–17px; eyebrows 10px uppercase 2px tracking.

## States to preserve

- Guest vs member hero CTA copy.
- Hero image load failure fallback.
- Active campaigns empty: the featured section is omitted, not replaced with an empty shell.
- Public fundraising disabled: `PrelaunchNotice` is visible.
- Story expanded/collapsed.
- Prompt composer idle, disabled/queued, and error feedback.
- Deep-link handoff to `/create?manual=1` and `/discover`.

## Responsive and accessibility

Mobile uses `px-4/px-5`, one-column grids, `min-h-11/12` targets, safe-area bottom padding, and the fixed bottom nav. From `sm` upward, the hero type and grids expand. Focus is a 3px aurora outline with 3px offset. Reduced motion removes button transforms and animated loading affordances. The prompt textarea must retain a visible label/helper relationship and Ctrl/Cmd+Enter behavior.

## Source crosswalk

`Home.jsx` · `BrandLogo.jsx` · `PromptComposer.jsx` · `CampaignCategoryGrid.jsx` · `CampaignCard.jsx` · `MobileBottomNav.jsx` · `QuickActions.jsx` · `PrelaunchNotice.jsx` · `PayPalDonateButton.jsx` · `LegalFooter.jsx` · `styles-ifund-studio.css` · `styles/ifund-next-cosmic.css`.

## Stitch variation guidance

Vary hero imagery, orbital accents, category illustration, and spacing rhythm. Do not move the prompt below the fold, remove the public/legal chrome, use fabricated campaign totals, or merge the homepage shell into the authenticated sidebar shell.
