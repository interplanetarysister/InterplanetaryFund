# IFund Studio — shared product design system

## One public identity across every supported screen
The shared React/Vite and Base44 frontend is the authoritative presentation
for the website, responsive phone browser, desktop browser and installable
standalone PWA. There is no native APK/IPA in this repository.

- A single studio stylesheet is imported from src/index.css. It contains
  branded blue-orbit/violet accents, restrained copper accents, high-contrast
  ink/navy, refined Manrope/Inter product typography and Fraunces editorial
  storytelling type. The official IFund planet image remains the brand mark.
- Layout.jsx owns the consistent responsive sidebar, mobile header, bottom
  navigation and context-aware workspace bar on all routed authenticated and
  public community/discovery pages.
- Home, About and Contact share the editorial hero and readable page framing.
- AuthLayout owns coherent account sign-in/recovery. DeviceActivation and the
  unknown-route fallback share the same branded darker treatment.
- Both color schemes use the same component geometry and responsive spacing.
  Dark-mode secondary text contrast was increased.
- The installable web app uses the same bundle and matching manifest chrome.
- Guests no longer see signed-in quick-action shortcuts; buttons for actual
  authenticated features retain their existing handlers and access gates.
- The image component falls back to IFund's own local official logo instead
  of relying on a third-party image placeholder.

## Zero-cost regression gates
- Vite blocks circular static chunk imports in any production build.
- npm postbuild checks asset size, complete ESM graph and static link/assets.
- scripts/verify-ifund-studio-pages.mjs checks 12 public routes at mobile/light
  and desktop/dark viewport sizes in real Chromium, including normal 404,
  responsive overflow, official image/PWA icon decoding and error boundaries.
- scripts/verify-ifund-links-assets.mjs validates 44 declared routes, statically
  referenced internal links, existing local media/icons and named backend
  function references (currently 145 available handlers).
- scripts/verify-ifund-navigation.mjs exercises both public and mocked
  authenticated navigation. It does NOT use a real user's credentials.
- scripts/publish-ifund-safe.sh runs browser startup, navigation, the visual
  checks, feature-flag fail-closed behavior, agent/chat contracts, image
  generation mocks, typechecking, lint and source-integrity tests before a
  Base44-native site-only deployment; then retests the actual production site.
- The static test for missing internal destinations cannot prove all
  dynamically generated campaign URLs or external OAuth/provider routes.
  Automated agent/generation mocks do not prove paid provider keys, live
  connections, external account authorization, donation accounting or
  scheduled automations. Those need separate authorized live tests.

Do not remove consent, server-side permission checks, existing accounting,
subscriptions, donation reconciliation or publishing controls for visual work.
Do not run GitHub Actions for this release. When discovering a genuinely
missing dependency, add it to package.json/lockfile and test its import.

## Design principles
Dignity, human clarity, readable controls, keyboard focus, consistent brand
image, single-finger scrolling, semantic contrast, robust failure recovery,
reduced-motion support and predictable mobile back navigation. The site and
installable PWA must stay visually the same, including signed-in pages.


## Release identity
The web/PWA frontend release marker is ifund-20261008-studio-unified-design-v3.
Its public Base44 manifest is deliberately versioned separately from provider
credential setup and merchant donation verification.
