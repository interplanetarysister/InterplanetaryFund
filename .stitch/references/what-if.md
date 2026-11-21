# What If? private Mission entry

**Route:** `/what-if`  
**Owner:** `apps/web/src/pages/WhatIfStart.jsx`  
**Shell:** Public, outside the authenticated `Layout`; global account and advisory launchers remain available because this is not the exact homepage.  
**Capture:** @html/what-if-support-desktop.html, @html/what-if-support-mobile.html, @screenshots/what-if-support-desktop.png, @screenshots/what-if-support-mobile.png. The local reference build sets `VITE_IFUND_WHAT_IF_ENABLED=enabled`; this is a capture-only setting, not a production release decision. The capture fills one synthetic prompt and selects noncash transportation support, but does not click Explore or Save.

## Purpose

What If? is the private, low-friction beginning of a Mission. A member can describe an idea and optionally say what kind of help would make it possible. Fundraising remains one possible pathway, not a prerequisite; saving a Mission still requires a verified account.

## Captured anatomy

1. **Cosmic hero.** A rounded, deep-navy field uses cyan and violet radial accents plus a faint linear line texture. The Fraunces `What if?` headline is followed by a plain invitation to describe what the visitor wants to make possible.
2. **Idea form.** Textarea `#what-if-prompt` accepts up to 12,000 characters with the label "Your idea, in your own words". Its placeholder includes "I want to… I need help with… What if we could…".
3. **Optional support selector.** `#what-if-support` defaults to **Not sure yet**. The 12 owner-facing options cover money, transportation, essentials, housing, care, connections, volunteers, equipment, education, community/environment, and something else. The selected option's examples appear immediately below without claiming a verified need.
4. **Noncash clarification.** "Money is only one kind of support. New Missions are private and do not need a fundraising goal."
5. **Actions.** "Explore possibilities" is a local preview action; "Save private Mission" requires a confirmed account. Guest saving retains the idea only after an explicit handoff notice and never writes an account record.
6. **Example ideas and alternate route.** Three synthetic example buttons are followed by links to My private Missions and the standard campaign editor.

## Support provenance rules

- An unanswered optional selector is `unspecified`; it is not silently classified as money.
- `missionSupportSummary`, `missionSupportPrompt`, and `missionSupportFields` return no fabricated support text for `unspecified`.
- Selecting transportation adds a bounded planning hint such as "Type of support to investigate: Vehicles and transportation". It remains an owner's stated need, not provider verification or eligibility.
- `missionGoalTypeForSupport` records a Mission category for later routing; it does not create a cash goal or infer an amount.
- The provisional preview explicitly says no sponsor, aid program, donation, or external action has been verified.

## Visual tokens

- Hero: `#020617`-based navy with cyan `rgba(23,204,226,.19)` and violet `rgba(178,82,226,.19)` radial fields, 32px radius, low-opacity white border.
- Headline: Fraunces 48px mobile / 72px desktop; the question mark uses cyan.
- Form: `rounded-3xl`, `border-white/15`, `bg-white/[.07]`, `backdrop-blur-sm`; textarea `rounded-2xl` with 16px text to avoid iOS zoom.
- Primary actions: cyan-400 fill with navy text, 48px minimum; secondary action is outlined white on dark.
- Support select: 48px minimum, `rounded-xl`, dark field with visible white label and a smaller slate example line.

## States to preserve

- Guest save notice: a verified account is needed; the idea has not been sent to the account.
- Session loading disables Save without hiding the form.
- Explore loading, error, and provisional preview states remain textual and editable.
- Restored guest handoff shows the scoped-browser-storage warning; it is not an account save receipt.
- Native select options are not expanded in the screenshots; their labels and provenance rules are documented here and in `supportNeeds.mjs`.

## Responsive and accessibility

The hero and form use one column at 390px, 12px radius on the select, 16px input text, 48px controls, and visible focus rings. The optional support label, examples, and money-is-not-required note stay adjacent to the control rather than in a detached tooltip.

## Source crosswalk

`WhatIfStart.jsx` · `supportNeeds.mjs` · `api/missions.js` · `useAuthSession` · `App.jsx` · `styles-cosmic-refinement.css`.

## Stitch variation guidance

Vary orbit geometry, form density, and example-card treatment. Do not make the optional support selector required, default it to money, present a Mission as a published campaign, or show an unverified preview as a grant, sponsor, or donation result.
