# IFund navigation recovery and repeat-regression prevention

## Verified failures and repairs
- The previously published homepage and login could crash at startup because
  manual vendor chunks had cyclic React/ReactDOM/React Router imports.
  Keep React in react-runtime.
- Public Discover and Community routes could crash with a viem-chains
  initialization ReferenceError because interdependent viem modules were
  forced into cyclic vendor chunks. Keep viem in one coherent runtime and
  isolate crypto-primitives and wallet modules by dependency graph.
- A fixed, empty toast overlay intercepted taps on the mobile menu. Toast
  containers now ignore pointer events; real toast cards remain clickable.
- Bottom navigation used mutable tab history, which made two tabs appear
  selected or navigated to an old detail page instead of the selected tab.
  Current route now determines exactly one active tab and each tab links
  directly to its destination.
- Left-edge back gestures and Back buttons previously used a page-visit
  counter / global browser history length, which could leave the app.
  Fallback is now a known IFund section or home when no in-app history index.
- Mobile menu now automatically closes after a route change. Shared app
  authorization state controls the navigation rather than redundant account
  fetches that flicker between guest and signed-in menus.
- Scroll position resets reliably on route changes. Global Globe has explicit
  Home and Browse campaigns return links.

## Regression prevention
1. Every Vite production build runs a native generateBundle graph check,
   blocking deployment if generated JavaScript chunks have circular static
   imports, regardless of npm command.
2. The npm postbuild hook checks chunk budgets and static module cycles.
3. scripts/verify-ifund-browser-render.mjs opens pages in Chromium and
   rejects uncaught JavaScript exceptions.
4. scripts/verify-ifund-navigation.mjs clicks public mobile bottom tabs,
   checks active state, opens the menu despite toast layers, navigates via
   the menu, visits and exits Global Globe, tests safe Back, traverses the
   desktop sidebar, and repeats authenticated bottom-nav routes using mock
   responses (no personal credentials).
5. scripts/publish-ifund-safe.sh runs the build, gates, all browser tests,
   typechecks and lint; it then uses native Base44 website publishing and
   re-runs both browser tests on the real custom domain.
6. Publish through this verified script for future IFund website releases.
   Base44's dashboard publish control may not invoke the shell script, so
   a manual publication outside this path still needs the same checks.

## Current downloadable footprint
- Compiled PWA/web-app directory: approximately 8.2 MB uncompressed. This is
  all pages and code-split chunks; not an up-front download.
- A cold mobile Chromium run of the previously published website downloaded
  about 0.75 MB before accepting the permissions screen, 0.84 MB after
  loading the homepage (includes third-party resources).
- No APK, AAB or IPA exists in this Base44 project; installing a website
  shortcut is not equivalent to downloading a packaged native application.
- The manifest is present. This project has no app-specific service worker;
  offline install behavior and app stores require separate verification.

## Dependency policy
- Playwright 1.64.0 is declared as a devDependency for browser regressions.
- es-module-lexer 1.7.0 is declared as a devDependency for precise ESM import
  cycle detection.
- Headless Chromium and operating-system browser libraries are verification
  environment requirements, not files to ship to end users.
- When a referenced runtime/build/test dependency is genuinely missing,
  add it to the relevant project manifest, lock versions, and run smoke tests.

This release does not modify financial operations, payment provider accounts
or campaign ledger balances. No GitHub tools or Actions are necessary.
