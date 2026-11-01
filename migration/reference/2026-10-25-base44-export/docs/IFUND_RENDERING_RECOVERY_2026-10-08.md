# Live rendering incident — IFund

A real Chromium headless browser reproduced the reported failure on all public
routes: TypeError reading useLayoutEffect of undefined, thrown during ES module
startup in the manually split ReactDOM vendor chunk.

The cause was a circular React/ReactDOM/React Router vendor import introduced by
manualChunks in vite.config.js. The fix keeps React, ReactDOM, scheduler and
React Router together as one react-runtime chunk, avoiding the circular
initialization order. Browser verification now runs on actual rendered routes,
not merely HTTP 200 or a syntactically valid production build.

Secondary fix: AuthContext now sets authChecked=true if fetching public
settings fails. Previously this could leave ProtectedRoute in an infinite
loading spinner, even after its public-settings failure had been recorded.

Playwright is declared as a devDependency at version 1.64.0. The smoke test
is scripts/verify-ifund-browser-render.mjs, callable with
npm run verify:browser-render. It starts a local Vite preview by default,
loads /, /login and /activate, completes the explicit first-session agreement,
asserts visible React content, and rejects any uncaught browser JS exception.
To test the published application set IFUND_SMOKE_URL to its HTTPS domain.
The headless Chromium browser must be installed in the verification environment
with npx playwright install --with-deps chromium-headless-shell.

No payment or data mutation is part of this repair. Base44's native site
deployment does not run GitHub Actions. Both a local browser test and a second
production-domain browser test are required before claiming the site rendered.
