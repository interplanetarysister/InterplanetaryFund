import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoDir = path.resolve(import.meta.dirname, "..");
const stitchDir = path.join(repoDir, ".stitch");
const designPath = path.join(stitchDir, "DESIGN.md");
const referencesDir = path.join(stitchDir, "references");
const manifestPath = path.join(stitchDir, "capture-manifest.json");
const lintPath = path.join(stitchDir, "validation/design-md-lint.json");

const expectedSections = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Motion & Micro-interaction",
  "Voice & Content Strategy",
  "Components",
  "Do's and Don'ts",
];

function slugify(heading) {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function externalReferences(text) {
  return [...text.matchAll(/@([A-Za-z0-9._/-]+\.[A-Za-z0-9]+)(?:#([^\s`)\]]+))?/g)]
    .map((match) => ({ target: match[1], fragment: match[2] || null }));
}

test("DESIGN.md follows the official Stitch section order and token schema", () => {
  assert.ok(existsSync(designPath), "missing .stitch/DESIGN.md");
  const design = readFileSync(designPath, "utf8");
  const frontmatter = design.match(/^---\n([\s\S]*?)\n---/)?.[1];
  assert.ok(frontmatter, "DESIGN.md must begin with YAML frontmatter");

  for (const tokenGroup of ["colors:", "typography:", "rounded:", "spacing:", "motion:", "components:"]) {
    assert.match(frontmatter, new RegExp(`^${tokenGroup.replace(":", "\\:")}`, "m"));
  }
  assert.match(frontmatter, /^version: alpha$/m);
  assert.match(frontmatter, /^  primary: "#2474F5"$/m);
  assert.match(frontmatter, /^  agent:\n(?:    [a-z]+: "#[0-9A-F]{6}"\n){9}/m);

  let cursor = -1;
  for (const section of expectedSections) {
    const heading = `## ${section}`;
    const index = design.indexOf(heading);
    assert.notEqual(index, -1, `missing required section: ${heading}`);
    assert.ok(index > cursor, `section out of order: ${heading}`);
    cursor = index;
  }
});

test("every Stitch external reference resolves inside .stitch", () => {
  const documents = [designPath];
  for (const name of readdirSync(referencesDir)) {
    if (name.endsWith(".md")) documents.push(path.join(referencesDir, name));
  }

  let checked = 0;
  for (const document of documents) {
    const text = readFileSync(document, "utf8");
    for (const { target, fragment } of externalReferences(text)) {
      const resolved = path.resolve(stitchDir, target);
      assert.equal(
        resolved.startsWith(stitchDir + path.sep),
        true,
        `${target} in ${path.basename(document)} escapes .stitch`,
      );
      assert.ok(existsSync(resolved), `broken reference in ${path.basename(document)}: ${target}`);

      if (fragment) {
        const contents = readFileSync(resolved, "utf8");
        if (/\.md$/.test(target)) {
          const headings = [...contents.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slugify(match[1]));
          assert.ok(headings.includes(slugify(fragment)), `missing markdown fragment: ${target}#${fragment}`);
        } else if (/\.html?$/.test(target)) {
          assert.ok(
            contents.includes(`<!-- COMPONENT: ${fragment} -->`),
            `missing HTML component marker: ${target}#${fragment}`,
          );
        }
      }
      checked += 1;
    }
  }

  assert.ok(checked >= 20, `expected a complete reference graph, found ${checked} references`);
});

test("official DESIGN.md lint evidence remains structurally clean", () => {
  assert.ok(existsSync(lintPath), "missing official DESIGN.md lint evidence");
  const lint = JSON.parse(readFileSync(lintPath, "utf8").replace(/^\uFEFF/, ""));
  assert.equal(lint.summary.errors, 0);
  assert.ok(lint.findings.every((finding) => finding.severity !== "error"));
});

test("capture manifest covers all four requested screens at two viewports", () => {
  assert.ok(existsSync(manifestPath), "missing .stitch/capture-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.captures.length, 10);
  assert.match(manifest.strategy, /Strategy A/);

  const ids = new Set(manifest.captures.map((capture) => capture.id));
  for (const id of [
    "homepage-desktop",
    "homepage-mobile",
    "dashboard-desktop",
    "dashboard-mobile",
    "campaign-creator-desktop",
    "campaign-creator-mobile",
    "agent-chat-desktop",
    "agent-chat-mobile",
    "agent-team-overview-desktop",
    "agent-team-overview-mobile",
  ]) {
    assert.ok(ids.has(id), `missing capture: ${id}`);
  }

  for (const capture of manifest.captures) {
    const htmlPath = path.join(repoDir, capture.html);
    assert.ok(existsSync(htmlPath), `missing HTML for ${capture.id}`);
    const capturedHtml = readFileSync(htmlPath, "utf8");
    assert.doesNotMatch(capturedHtml, /<script\b/i, `script survived extraction for ${capture.id}`);
    assert.doesNotMatch(
      capturedHtml,
      /rel=["']modulepreload["']/i,
      `modulepreload link survived extraction for ${capture.id}`,
    );
    assert.ok(existsSync(path.join(repoDir, capture.screenshot)), `missing screenshot for ${capture.id}`);
    assert.ok(
      Number.isInteger(capture.viewport.width) && capture.viewport.width > 0,
      `invalid width for ${capture.id}`,
    );
    assert.ok(
      Number.isInteger(capture.viewport.height) && capture.viewport.height > 0,
      `invalid height for ${capture.id}`,
    );
    assert.match(capture.renderState, /Unauthenticated/);
    assert.deepEqual(capture.consoleErrors, [], `console errors captured for ${capture.id}`);

    if (capture.id.startsWith("dashboard-")) {
      assert.match(
        capture.visibleTextPreview,
        /Account services are unavailable\.\s*Return to sign in\./,
        `dashboard guest state is not fail-closed for ${capture.id}`,
      );
      assert.doesNotMatch(
        capture.visibleTextPreview,
        /Make your what if happen\./,
        `private dashboard content leaked into ${capture.id}`,
      );
      continue;
    }

    assert.ok(capture.headings.length > 0, `no headings captured for ${capture.id}`);
    if (capture.id.startsWith("agent-chat-")) {
      assert.equal(capture.panelOpened, "visible", `agent panel not opened for ${capture.id}`);
    }
  }
});

test("design references describe the current merged UI contracts", () => {
  const homepage = readFileSync(path.join(referencesDir, "homepage.md"), "utf8");
  assert.match(homepage, /What if anything were possible\?/);
  assert.match(homepage, /\/our-story/);
  assert.match(homepage, /agent launcher and side panel are hidden on the exact homepage path/);
  assert.doesNotMatch(homepage, /Be here from the beginning/);
  assert.doesNotMatch(homepage, /CampaignCategoryGrid/);

  const creator = readFileSync(path.join(referencesDir, "campaign-creator.md"), "utf8");
  for (const phrase of [
    "Three-icon stepper",
    "CampaignVoiceInput",
    "More agent help (optional)",
    "Tell us what matters",
    "publishing requires neither AI review nor a story-length target",
  ]) {
    assert.ok(creator.includes(phrase), `campaign creator reference is stale: ${phrase}`);
  }

  const agentChat = readFileSync(path.join(referencesDir, "agent-chat.md"), "utf8");
  assert.match(agentChat, /except the exact homepage/);
  const agentTeam = readFileSync(path.join(referencesDir, "agent-team-overview.md"), "utf8");
  assert.match(agentTeam, /cannot move money or initiate withdrawals/);
  const design = readFileSync(designPath, "utf8");
  assert.match(design, /except the exact homepage/);
  assert.match(design, /56px icon buttons/);

  const workspaces = readFileSync(
    path.join(repoDir, "apps/web/src/lib/agentWorkspaces.mjs"),
    "utf8",
  );
  assert.match(workspaces, /Your fundraising finances and verified donations/);
  assert.match(workspaces, /ORBIT cannot move money or initiate withdrawals/);

  const goalAnalysis = readFileSync(
    path.join(repoDir, "apps/web/src/components/agents/GoalSuccessAnalysis.jsx"),
    "utf8",
  );
  assert.match(goalAnalysis, /Goal Success Analysis/);
  assert.match(goalAnalysis, /No funds or supplies confirmed/);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const capture = (id) => manifest.captures.find((item) => item.id === id);
  assert.deepEqual(capture("homepage-desktop").headings, [
    "What if anything were possible?",
    "Start with an idea",
    "Make it your own",
    "Grow with support",
  ]);
  for (const id of ["campaign-creator-desktop", "campaign-creator-mobile"]) {
    assert.ok(capture(id).headings.includes("New Campaign"), `missing creator heading for ${id}`);
    assert.ok(capture(id).headings.includes("Tell us what matters"), `missing compact prompt for ${id}`);
  }
});
