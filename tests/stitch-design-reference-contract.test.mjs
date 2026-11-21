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
    .map((match) => ({
      target: match[1],
      fragment: match[2] ? match[2].replace(/[.,;:!?]+$/, "") : null,
    }));
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

  assert.ok(checked >= 32, `expected a complete reference graph, found ${checked} references`);
});

test("official DESIGN.md lint evidence remains structurally clean", () => {
  assert.ok(existsSync(lintPath), "missing official DESIGN.md lint evidence");
  const lint = JSON.parse(readFileSync(lintPath, "utf8").replace(/^\uFEFF/, ""));
  assert.equal(lint.summary.errors, 0);
  assert.ok(lint.findings.every((finding) => finding.severity !== "error"));
});

test("capture manifest covers the merged reference screens at two viewports", () => {
  assert.ok(existsSync(manifestPath), "missing .stitch/capture-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.captures.length, 18);
  assert.match(manifest.strategy, /Strategy A/);
  assert.match(
    manifest.buildVariables?.VITE_IFUND_WHAT_IF_ENABLED || "",
    /enabled.*local reference build only/i,
    "what-if capture build variable must be documented as local-only",
  );
  assert.ok(
    manifest.constraints.some((line) => /no draft or account mutation/i.test(line)),
    "local interaction boundaries must be documented",
  );

  const ids = new Set(manifest.captures.map((capture) => capture.id));
  for (const id of [
    "homepage-desktop",
    "homepage-mobile",
    "dashboard-desktop",
    "dashboard-mobile",
    "auth-voice-desktop",
    "auth-voice-mobile",
    "what-if-support-desktop",
    "what-if-support-mobile",
    "campaign-creator-desktop",
    "campaign-creator-mobile",
    "campaign-voice-artwork-desktop",
    "campaign-voice-artwork-mobile",
    "campaign-launch-eclipse-desktop",
    "campaign-launch-eclipse-mobile",
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
    assert.doesNotMatch(
      capturedHtml,
      /[ \t]+$/m,
      `trailing whitespace survived extraction for ${capture.id}`,
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
    assert.ok(Array.isArray(capture.interactions), `missing interaction record for ${capture.id}`);

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
    if (capture.id.startsWith("agent-chat-") || capture.id.startsWith("auth-voice-")) {
      assert.equal(capture.panelOpened, "visible", `agent panel not opened for ${capture.id}`);
    }
    if (capture.id.startsWith("auth-voice-")) {
      assert.match(capture.visibleTextPreview, /Use NEXUS voice navigation/);
      assert.match(capture.visibleTextPreview, /never speak passwords or codes/i);
    }
    if (capture.id.startsWith("what-if-support-")) {
      assert.equal(capture.requiredBuildVariable, "VITE_IFUND_WHAT_IF_ENABLED=enabled");
      assert.match(capture.visibleTextPreview, /Money is only one kind of support/);
      assert.match(capture.visibleTextPreview, /Vehicles and transportation/);
    }
    if (capture.id.startsWith("campaign-voice-artwork-")) {
      assert.match(capture.visibleTextPreview, /Have NEXUS guide me by voice \(optional\)/);
      assert.match(capture.visibleTextPreview, /Or create your own original iFund illustration/);
      assert.match(capture.visibleTextPreview, /Image words \(optional, exact spelling\)/);
      assert.match(capture.visibleTextPreview, /Use campaign title exactly/);
      assert.match(capture.visibleTextPreview, /iFund adds these exact words using a regular font/);
      assert.ok(
        capture.interactions.some(
          (interaction) =>
            interaction.type === "fill" && interaction.value === "Mikki's lemonade stand",
        ),
        `exact caption interaction missing for ${capture.id}`,
      );
    }
    if (capture.id.startsWith("campaign-launch-eclipse-")) {
      assert.match(capture.visibleTextPreview, /Your defining moment · Review before publishing/);
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

  const authVoice = readFileSync(path.join(referencesDir, "auth-voice.md"), "utf8");
  assert.match(authVoice, /never speak passwords or codes/);
  assert.match(authVoice, /Sign-in-first|member-only commands open secure sign-in/i);
  const whatIf = readFileSync(path.join(referencesDir, "what-if.md"), "utf8");
  for (const phrase of [
    "Not sure yet",
    "Money is only one kind of support",
    "An unanswered optional selector is `unspecified`",
  ]) {
    assert.ok(whatIf.includes(phrase), `What If reference is stale: ${phrase}`);
  }
  assert.match(creator, /Optional NEXUS voice guide/);
  assert.match(creator, /Step 2 — Launch review eclipse/);
  assert.match(creator, /AI-generated illustration/);
  assert.match(creator, /Image words \(optional, exact spelling\)/);
  assert.match(creator, /never machine-corrected/);
  assert.match(creator, /50-attempt rolling seven-day allowance/);
  assert.match(design, /exact-caption-input/);
  assert.match(design, /never let the image model redraw or "improve" spelling/);
  assert.match(design, /cosmic-symmetry\.svg/);
  assert.match(design, /cosmic-eclipse\.svg/);
  assert.match(design, /Spoken navigation is advisory and local/);
  assert.match(design, /Money is one of twelve needs/);

  const stickerSheet = readFileSync(path.join(stitchDir, "components/sticker-sheet.html"), "utf8");
  for (const marker of [
    "voice-guide",
    "support-selector",
    "artwork-choice",
    "exact-caption-input",
    "eclipse-review-panel",
    "auth-voice-callout",
  ]) {
    assert.ok(stickerSheet.includes(`<!-- COMPONENT: ${marker} -->`), `missing sticker component: ${marker}`);
  }

  const support = readFileSync(path.join(repoDir, "apps/web/src/lib/supportNeeds.mjs"), "utf8");
  assert.match(support, /id:"unspecified",label:"Not sure yet"/);
  assert.match(support, /need\.id==="unspecified"\?""/);
  const voice = readFileSync(path.join(repoDir, "apps/web/src/lib/voiceSiteIntents.mjs"), "utf8");
  assert.match(voice, /signInRequired:true/);
  assert.match(voice, /No account action, outside post, or publication has occurred/);
  const voiceGuide = readFileSync(
    path.join(repoDir, "apps/web/src/components/campaigns/CampaignVoiceGuide.jsx"),
    "utf8",
  );
  assert.match(voiceGuide, /supportNeed\(supportType\)\.cash===true/);
  const artwork = readFileSync(
    path.join(repoDir, "apps/web/src/components/campaigns/CampaignImageChoices.jsx"),
    "utf8",
  );
  assert.match(artwork, /onApply\(url,\{cover_image_is_ai:true\}\)/);
  assert.match(artwork, /overlayExactArtworkCaption\(raw,caption\)/);
  assert.match(artwork, /50 image-generation or improvement attempts per rolling seven days/);
  assert.match(stickerSheet, /50 image-generation or improvement attempts per rolling seven days/);
  const exactCaption = readFileSync(
    path.join(repoDir, "apps/web/src/lib/exactArtworkCaption.mjs"),
    "utf8",
  );
  assert.match(exactCaption, /ctx\.fillText\(line/);
  assert.doesNotMatch(exactCaption, /spellcheck|autocorrect|generateText|AI\.run/);
  const lifecycle = readFileSync(path.join(repoDir, "apps/web/src/lib/campaignLifecycle.js"), "utf8");
  assert.match(lifecycle, /export function withCoverProvenance/);
  const publicData = readFileSync(path.join(repoDir, "apps/web/src/api/publicData.js"), "utf8");
  assert.match(publicData, /cover_image_is_ai: coverIsAI\(row\.cover_image_url/);
  const detail = readFileSync(path.join(repoDir, "apps/web/src/pages/CampaignDetail.jsx"), "utf8");
  assert.match(detail, /AI-generated illustration/);
});
