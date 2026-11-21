# Stitch preparation — Interplanetary Fund

This directory is an **additive, source-only design-reference kit** for Google Stitch. No application component, stylesheet, route, SQL, Worker, lockfile, or deployment setting was changed to create it.

## What is here

- `DESIGN.md` — Stitch-compatible design system following Google's published DESIGN.md alpha schema. YAML frontmatter is normative; the markdown sections explain intent.
- `components/sticker-sheet.html` — representative component anatomy with `<!-- COMPONENT: name -->` markers for Stitch external references.
- `references/` — source-derived specifications for the public homepage, member dashboard, campaign creator, persistent agent chat, and AI Team overview.
- `scripts/capture-references.mjs` — reproducible local Strategy A capture script.
- `html/` and `screenshots/` — computed-style-resolved static HTML and desktop/mobile screenshots generated from a local `apps/web` production build.
- `capture-manifest.json` — exact routes, viewports, headings, console errors, blocked requests, and render-state caveats for every capture.

## Capture method

Google's official `stitch::code-to-design` workflow recommends Strategy A for a local built app: extract static HTML with computed styles resolved, extract the design system from source, then upload. This kit performs the first two steps locally. The third step was not performed because no Stitch MCP server, upload tool, or project authorization is available in this session.

The capture script:

1. requires `apps/web/dist` from `npm.cmd run build` in `apps/web`;
2. starts Vite preview on `http://127.0.0.1:4178` only;
3. aborts all non-GET requests and all non-local HTTP(S) requests;
4. renders each route at 1365×900 and 390×844;
5. inlines same-origin CSS, images, and fonts as data URIs, removes scripts, and writes static HTML;
6. takes viewport screenshots and records a manifest.

To regenerate:

```powershell
cd apps/web
npm.cmd run build
cd ../..
node .stitch/scripts/capture-references.mjs
```

## Validation

Google's official DESIGN.md CLI was run with:

```powershell
npx.cmd -p @google/design.md designmd lint --format json .stitch/DESIGN.md
```

Result: **0 errors**, 59 warnings, 1 info. The actionable contrast warning was resolved by introducing the `colors.action` CTA token while preserving the shipped `colors.primary` value. Remaining warnings are intentional: grouped light/dark/studio/cosmic/agent palettes are reference libraries rather than component-bound tokens, and the CLI version flags `motion` as ignored by its exporters even though the published specification includes it.

## Evidence limits

- Captures are **unauthenticated/public render states only**. The dashboard capture is the account-services-unavailable guest shell, not the signed-in workspace. Dashboard, creator, agent chat, and AI Team signed-in anatomy is documented from source but is **NOT TESTED** in a browser.
- The agent chat capture opens the side panel with a local UI event; no question was sent and no hosted inference was invoked.
- External providers, Supabase, Cloudflare, PayPal, mail routing, OAuth grants, and staging/production origins were not contacted by the capture.
- No Stitch project, branch, preview, production deployment, or GitHub action was created or modified.
- Blocked analytics/remote requests in the manifest are a consequence of the read-only local harness, not a claim about hosted behavior.

## How to use with Stitch

When a Stitch tool becomes available, import `DESIGN.md` from this directory and attach the closest `@html/…` capture or `@screenshots/…` image. Ask for variations in hierarchy, spacing, illustration, and polish while preserving the tokens, section order, accessible roles, state copy, and advisory/legal language in the references.

Do not authorize Stitch to write to `main`. Treat generated output as a design proposal until a human reviews it and the normal iFund source, test, preview, and release gates are satisfied.
