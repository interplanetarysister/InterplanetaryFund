# Homepage

**Route:** `/`  
**Owner:** `apps/web/src/pages/Home.jsx`  
**Shell:** Public page, deliberately outside `Layout`; `GlobalAgentCompanion` still wraps the route, but the agent launcher and side panel are hidden on the exact homepage path. The persistent Log in / Account launcher remains.
**Capture:** @html/homepage-desktop.html, @html/homepage-mobile.html, @screenshots/homepage-desktop.png, @screenshots/homepage-mobile.png. Captured unauthenticated at 1365×900 and 390×844.

## Purpose

The homepage is a focused invitation: one memorable brand promise, one immediate prompt, and three unobtrusive paths into campaign creation, discovery, and platform information. It should feel expansive and editorial, but the next action must be obvious within one viewport. The former long-form public homepage is preserved separately at `/our-story` by `apps/web/src/pages/OurStory.jsx`; it is not part of this capture set.

## Section order and anatomy

1. **Public chrome.** `.ifund-public` on a deep navy field. `QuickActions` sits at the lower left, `MobileBottomNav` uses safe-area bottom padding, and the global account launcher stays available. No `PrelaunchNotice` or agent launcher is rendered here.
2. **Atmospheric hero field.** A `relative isolate` container with decorative radial blue/teal fields and a masked 72px dot grid, both `aria-hidden` and pointer-transparent. The current public surface also layers the local `cosmic-symmetry.svg` geometry and a slow cyan/violet drift; reduced motion freezes it, print removes it, and no network hero image is requested.
3. **Public header.** `BrandLogo` links home; `Our Story` links to `/our-story`; `Discover` appears from `sm`; the right action is `Dashboard` for a verified non-anonymous member and `Log in` for everyone else.
4. **Hero.** Centered `max-w-5xl` content: pill eyebrow "Interplanetary Fund", `h1` "What if anything were possible?" with "anything" in brand gradient, a short supporting lede, and `PromptComposer id="home-what-if" variant="hero"`. The composer label is "What would you like to make possible?", the submit label is "Build my campaign", the limit is 1,500 characters, and the note says "Your idea stays private until you choose to publish."
5. **Secondary actions.** "Start a campaign without a prompt" → `/create?manual=1`, "Explore campaigns" → `/discover`, and "Get the IFund app" → `/download` with an installation helper line.
6. **Guest identity row.** Shown only when signed out: "Already a member?" with Log in and Create a free account links.
7. **How IFund helps.** Three bordered cards in one column on mobile and three from `sm`: "Start with an idea", "Make it your own", and "Grow with support". These are informational cards, not campaign results or donation claims.
8. **Closing links and legal footer.** "Discover our story" and "Fundraising partners", followed by `LegalFooter`, whose link row also includes `Our Story`, About, Contact, Terms, Privacy, Health Privacy, Help & Legal, and Get the app.

## Visual tokens

- Hero field: `#080c18 → #0e1529 → #080c18`; blue `rgba(65,94,210,.20)` and teal `rgba(23,165,176,.11)` radial accents; dot grid lines `rgba(153,190,255,.06)`; symmetry geometry stroke gradient `#28E8FF → #7688FF → #FF69DE → #6EFFBB`, low opacity.
- Focused content: `max-w-5xl`, centered, `px-5 sm:px-8`, generous top padding, and at least 44px interactive controls.
- Headline: Fraunces display, 48px mobile / 72px desktop, tight tracking; "anything" uses the cyan/blue/violet brand gradient.
- Prompt card: `#111a30/95`, 24px radius, low-opacity cyan border, 20px mobile / 28px desktop padding, dark textarea.
- Secondary links: outlined pills or underlined cyan text; 48px minimum where they are primary alternatives.
- Information cards: `rounded-2xl`, `border-white/10`, `bg-white/[.04]`, 24px padding, cyan numbered eyebrows.

## States to preserve

- Member header action is Dashboard; guest header action is Log in and the guest identity row is visible.
- The global account launcher says Account for a signed-in member and Log in for a guest.
- Prompt composer idle, disabled/queued, and error feedback; Ctrl/Cmd+Enter submits.
- Prompt submission carries the private idea to `/create?manual=1` with `source: "home-what-if"`; no campaign is saved or published by the homepage.
- No featured campaigns, category grid, expandable foundation story, hero-image fallback, or platform-support card belongs on this simplified homepage; those patterns remain on `/our-story`.
- No agent launcher, agent panel, or externally dispatched agent event may appear on the exact homepage route.

## Responsive and accessibility

Mobile uses `px-5`, one-column cards, safe-area bottom padding, and the fixed bottom navigation. From `sm` upward, the headline grows, Discover enters the header, and the information cards form three columns. Focus is a visible cyan outline; reduced motion removes decorative movement. The prompt textarea retains a visible label/helper relationship and keyboard submission.

## Source crosswalk

`Home.jsx` · `OurStory.jsx` (archived long-form page) · `BrandLogo.jsx` · `PromptComposer.jsx` · `MobileBottomNav.jsx` · `QuickActions.jsx` · `GlobalAgentCompanion.jsx` · `LegalFooter.jsx` · `useAuthSession` · `styles-cosmic-refinement.css` · `cosmic-symmetry.svg`.

## Stitch variation guidance

Vary atmospheric accents, headline spacing, card illustration, and prompt-card polish. Do not move the prompt below the fold, add fabricated campaign totals or supporter counts, reintroduce the archived long-form sections here, enable agent chat on Home, or merge the public shell into the authenticated sidebar shell.
