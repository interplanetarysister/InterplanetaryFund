import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 8 (2026-11-25): IFund Social Stories/News tabs (40-page list).
// Posts, Shorts, Stories and News live on /social (?tab=posts|shorts|
// stories|news, default posts); /blogs and /news redirect here (App.jsx).
// Stories renders the existing Blogs list, News renders its news variant.
// Source-level assertions, as in sprint-5-media-studio.test.mjs: the page
// is a JSX component, so these tests assert the wiring that produces each
// tab behaviour rather than rendering it.

test("social tabs are exactly posts, shorts, stories and news, in order, with posts as the fallback", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /const SOCIAL_FEED_TABS = Object\.freeze\(\[\s*\{ id: "posts", label: "Posts" \},\s*\{ id: "shorts", label: "Shorts" \},\s*\{ id: "stories", label: "Stories" \},\s*\{ id: "news", label: "News" \},\s*\]\);/);
  assert.match(page, /function tabFromParam\(value\) \{/);
  assert.match(page, /SOCIAL_FEED_TABS\.find\(\(tab\) => tab\.id === String\(value \|\| ""\)\.toLowerCase\(\)\)/);
  assert.match(page, /return found \? found\.id : "posts";/);
  assert.match(page, /const tab = tabFromParam\(params\.get\("tab"\)\);/);
  assert.match(page, /const showFeed = community \|\| tab === "posts";/);
});

test("tablist follows the MediaStudio/AgentsTeam pattern: useSearchParams, role tablist/tab, aria-selected", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /const \[params, setParams\] = useSearchParams\(\);/);
  assert.match(page, /role="tablist" aria-label="Social feed views"/);
  assert.match(page, /SOCIAL_FEED_TABS\.map\(\(item\) => \(/);
  assert.match(page, /role="tab" id=\{`social-tab-\$\{item\.id\}`\}/);
  assert.match(page, /aria-selected=\{tab === item\.id\} aria-controls=\{`social-panel-\$\{item\.id\}`\}/);
  assert.match(page, /onClick=\{\(\) => setTab\(item\.id\)\}/);
  // Active/inactive pairing matches AgentsTeam (bg-primary vs bg-card).
  assert.match(page, /tab === item\.id \? "bg-primary text-primary-foreground" : "bg-card"/);
  // 44px touch targets in a wrapping row: no horizontal overflow at 320px.
  assert.match(page, /className="flex flex-wrap gap-2"/);
  assert.match(page, /ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold/);
  // The old two-link Posts/Shorts grid nav is gone from both branches.
  assert.doesNotMatch(page, /grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1/);
  assert.doesNotMatch(page, /aria-current="page" className="ifund-interactive flex min-h-11 items-center justify-center rounded-xl bg-primary/);
});

test("default (no ?tab) and unknown tabs show the Posts feed", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  // Missing or unknown ?tab= falls back to "posts" (previous test), and the
  // feed (compose form + public timeline) renders exactly for that tab.
  assert.match(page, /\{showFeed && <div \{\.\.\.postsPanelProps\} className="space-y-6">/);
  assert.match(page, /role: "tabpanel", id: "social-panel-posts", "aria-labelledby": "social-tab-posts"/);
  assert.match(page, /<SocialPostList posts=\{timeline\}/);
  assert.match(page, /<form onSubmit=\{publish\}/);
});

test("?tab=shorts still shows Shorts, unchanged apart from the shared tablist", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /if \(!community && tab === "shorts"\) return/);
  assert.match(page, /<div role="tabpanel" id="social-panel-shorts" aria-labelledby="social-tab-shorts">\s*<OrbitShorts \/>\s*<\/div>/);
  assert.match(page, /import OrbitShorts from "@\/pages\/OrbitShorts";/);
});

test("?tab=stories renders the existing blogs list", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /import Blogs from "@\/pages\/Blogs";/);
  assert.match(page, /\{!community && tab === "stories" && <div role="tabpanel" id="social-panel-stories" aria-labelledby="social-tab-stories">\s*<Blogs \/>\s*<\/div>\}/);
});

test("?tab=news renders the Blogs news variant", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /\{!community && tab === "news" && <div role="tabpanel" id="social-panel-news" aria-labelledby="social-tab-news">\s*<Blogs news \/>\s*<\/div>\}/);
});

test("Blogs fetches its own data and its news prop switches the Newscaster variant", () => {
  const blogs = read("src/pages/Blogs.jsx");
  assert.match(blogs, /export default function Blogs\(\{ news = false \}\)/);
  assert.match(blogs, /listPublishedStories\(\{ author \}\)/);
  assert.match(blogs, /news \? listFinalPublications\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(blogs, /news \? "IFund Newscaster" : "IFund Stories & Blogs"/);
  assert.match(blogs, /news \? "Official updates, newsletters, and announcements from Interplanetary Fund\." : "Member stories, fundraising ideas, and the Interplanetary Fund Reporter\."/);
  // SocialFeedPage adds no editorial fetching of its own.
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.doesNotMatch(page, /listPublishedStories|listFinalPublications/);
});

test("community variant, compose params and tab switching are preserved", () => {
  const page = read("src/pages/SocialFeedPage.jsx");
  assert.match(page, /export default function SocialFeedPage\(\{ community = false \}\)/);
  assert.match(page, /\{community && <CommunityDirectory \/>\}/);
  assert.match(page, /const campaignToShare = params\.get\("shareCampaign"\);/);
  assert.match(page, /const sharingUpdate = params\.get\("kind"\) === "update";/);
  assert.match(page, /const storyToShare = params\.get\("shareStory"\);/);
  assert.match(page, /const publicationToShare = params\.get\("sharePublication"\);/);
  // Switching tabs keeps the compose params, as AgentsTeam's setTab does.
  assert.match(page, /function setTab\(next\) \{\s*const nextParams = new URLSearchParams\(params\);\s*nextParams\.set\("tab", tabFromParam\(next\)\);\s*setParams\(nextParams, \{ replace: true \}\);/);
  // The community nav now points at the tabs instead of standalone routes.
  assert.match(page, /<Link to="\/social\?tab=stories">Stories &amp; Blogs<\/Link>/);
  assert.match(page, /<Link to="\/social\?tab=news">IFund Newscaster<\/Link>/);
  assert.doesNotMatch(page, /to="\/blogs"/);
  assert.doesNotMatch(page, /to="\/news"/);
});
