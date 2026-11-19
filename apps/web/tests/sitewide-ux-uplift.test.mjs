import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const app = src("../src/App.jsx");
const layout = src("../src/components/Layout.jsx");
const editor = src("../src/pages/CreateCampaign.jsx");
const plans = src("../src/pages/PublicSubscriptionPlans.jsx");
const boundary = src("../src/components/ErrorBoundary.jsx");

test("all lazy routes have a visible, accessible branded loading fallback", () => {
  assert.match(app, /const Loading = \(\) => <main role="status" aria-live="polite"/);
  assert.match(app, /Loading your iFund experience/);
  assert.match(app, /<Suspense fallback=\{<Loading \/>\}>/);
});

test("shared application provides accessible skip navigation and stable page identity", () => {
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /<div id="main-content" tabIndex=\{-1\} role=\{needsLayoutMainLandmark/);
  assert.match(layout, /useReducedMotion/);
  assert.match(layout, /opacity: 0, y: 8/);
  assert.doesNotMatch(layout, /opacity: 0, x: "100%"/);
});

test("three-step creator keeps AI, documents, partner tools and geography optional", () => {
  assert.match(editor, /Optional: AI team and campaign analysis/);
  assert.match(editor, /Optional: AI writing and story refinement/);
  assert.match(editor, /Optional: campaign documents/);
  assert.match(editor, /Optional: prepare for an external fundraising platform/);
  assert.match(editor, /Optional: schedule and campaign location/);
  assert.match(editor, /<details hidden=\{step!==0&&step!==1\}/);
  assert.match(editor, /<CampaignLocationFields/);
  assert.match(editor, /<CampaignReadinessScore/);
  assert.match(editor, /onClick=\{\(\) => save\("active"\)\}/);
});

test("subscription outage never invents prices or allows unverified enrollment", () => {
  assert.match(plans, /timedOut = true; controller\.abort\(\)/);
  assert.match(plans, /12000/);
  assert.match(plans, /No subscription was started/);
  assert.match(plans, /Subscriptions are temporarily unavailable/);
  assert.match(plans, /Retry verification/);
  assert.match(plans, /to="\/help"/);
  assert.match(plans, /to="\/contact"/);
  assert.match(plans, /plan\.available === true && plan\.verified === true/);
  assert.match(plans, /const isPreview = typeof window/);
  assert.match(plans, /isPreview\) \{ setState\(\{ phase: "preview"/);
  assert.match(plans, /Subscription enrollment is disabled in this preview/);
});

test("route crashes show accessible recovery and theme-consistent UI", () => {
  assert.match(boundary, /role="alert" aria-labelledby="ifund-route-error-heading"/);
  assert.match(boundary, /className=".*bg-card/);
  assert.match(boundary, /Visit Help Center/);
  assert.match(boundary, /isAssetLoadFailure/);
  assert.doesNotMatch(boundary, /text-stone-900/);
});
