import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = p => readFileSync(path.join(repoRoot, p), "utf8");
const exists = p => existsSync(path.join(repoRoot, p));

test("frontend quality contract and permanent directive are present and wired", () => {
  const contract = read("docs/design/IFUND_FRONTEND_QUALITY_CONTRACT_20261120.md");
  assert.match(contract, /Owner directive, November 20, 2026/u);
  assert.match(contract, /Cosmic Geometry/u);
  assert.match(contract, /320px, 390px, 768px and desktop widths/u);
  assert.match(contract, /Builder reconciliation note — 2026-11-22/u);
  const agents = read("AGENTS.md");
  assert.ok(agents.indexOf("Permanent premium frontend quality requirement") < agents.indexOf("Mandatory repair-first build sequence"));
  assert.match(agents, /IFUND_FRONTEND_QUALITY_CONTRACT_20261120\.md/u);
  const index = read("apps/web/src/index.css");
  const premiumAt = index.indexOf("./styles/premium-surface.css");
  assert.ok(premiumAt > 0, "premium material layer must be imported");
  assert.ok(premiumAt > index.indexOf("./styles-cosmic-refinement.css"), "material guards import after the geometry layer");
  assert.ok(premiumAt > index.indexOf("./styles-studio.css"), "material guards import after legacy studio layers");
});

test("material layer adds contrast, print and 320px guards without hijacking verified layout", () => {
  const surface = read("apps/web/src/styles/premium-surface.css");
  assert.ok(exists("apps/web/src/styles/premium-surface.css"));
  assert.match(surface, /prefers-contrast:\s*more/u);
  assert.match(surface, /@media print/u);
  assert.match(surface, /@media \(max-width: 360px\)/u);
  assert.match(surface, /:root\s*\{/u);
  assert.match(surface, /\.dark\s*\{/u);
  assert.match(surface, /outline-offset: 3px/u);
  // Contract material only: never reposition the verified Account + Ask IFund rail.
  assert.doesNotMatch(surface, /ifund-global-agent-launcher\s*\{[^}]*position:\s*fixed/u);
  assert.doesNotMatch(surface, /right:\s*24px/u);
  assert.doesNotMatch(surface, /bottom:\s*calc\(6\.5rem/u);
  // Never define a competing background geometry layer.
  assert.doesNotMatch(surface, /url\("data:image\/svg\+xml/u);
  assert.doesNotMatch(surface, /radial-gradient/u);
  // No unguarded motion, no fixed page attachment, no external decorative requests.
  assert.doesNotMatch(surface, /animation:/u);
  assert.doesNotMatch(surface, /background-attachment:\s*fixed\s*;/u);
  assert.doesNotMatch(surface, /https?:\/\//u);
});

test("Ask IFund, Account and QuickActions occupy disjoint horizontal zones on mobile and desktop", () => {
  const quick = read("apps/web/src/components/QuickActions.jsx");
  const css = read("apps/web/src/styles/agent-companion.css");
  const companion = read("apps/web/src/components/agents/GlobalAgentCompanion.jsx");
  // QuickActions is left-anchored at every breakpoint; it never moves into the right rail.
  assert.match(quick, /left-3 md:left-6 right-auto/u);
  assert.doesNotMatch(quick, /md:right-6/u);
  // Two-button rail on the right: Account sits left of Ask IFund, same baselines.
  assert.match(css, /\.ifund-global-agent-launcher \{[^}]*right:18px/u);
  assert.match(css, /\.ifund-global-account-launcher \{[^}]*right:177px/u);
  assert.match(css, /@media\(max-width:767px\)\s*\{\s*\.ifund-global-agent-launcher \{[^}]*right:12px/u);
  assert.match(css, /\.ifund-global-account-launcher \{\s*bottom:calc\(82px \+ env\(safe-area-inset-bottom\)\);\s*right:151px/u);
  assert.match(css, /outside the QuickActions plus-button lane/u);
  // Launcher is reachable, labelled and focus-visible; it renders off the home page only.
  assert.match(companion, /ifund-global-agent-launcher/u);
  assert.match(companion, /aria-label="Ask IFund for guidance or help navigating this page"/u);
  assert.match(css, /\.ifund-global-agent-launcher:focus-visible/u);
});

test("cosmic geometry stays the single rendered authority: symmetric, local, motion-safe, Earth-preserving", () => {
  const geometry = read("apps/web/src/styles-cosmic-refinement.css");
  const shell = read("apps/web/src/components/agents/GlobalAgentCompanion.jsx");
  // Symmetric local motif with balanced diagonal falloff, reduced-motion and print guards.
  assert.match(geometry, /cosmic-symmetry\.svg/u);
  assert.match(geometry, /cosmic-eclipse\.svg/u);
  assert.match(geometry, /prefers-reduced-motion/u);
  assert.match(geometry, /@media print/u);
  assert.equal((geometry.match(/radial-gradient\(ellipse/g) || []).length >= 2, true, "balanced radial pair required");
  assert.doesNotMatch(geometry, /https?:\/\//u, "decorative assets must stay local");
  // Dashboard Earth treatment remains excluded from decorative geometry.
  assert.match(shell, /pathname==="\/dashboard"\?" ifund-preserve-earth"/u);
  assert.match(geometry, /\.ifund-preserve-earth/u);
  // The contract material layer must not compete with the rendered geometry.
  const surface = read("apps/web/src/styles/premium-surface.css");
  assert.doesNotMatch(surface, /cosmic-symmetry|data:image\/svg/u);
  // Bundled local assets actually exist for both layers.
  assert.ok(exists("apps/web/public/cosmic-symmetry.svg"), "local symmetry asset required");
  assert.ok(exists("apps/web/public/cosmic-eclipse.svg"), "local eclipse asset required");
});
