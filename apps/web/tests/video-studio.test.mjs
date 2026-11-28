import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest } from "../functions/api/ai/videos/[[path]].js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("video studio component drives the real job lifecycle and never fakes a result", () => {
  const component = read("../src/pages/AIVideoStudio.jsx");
  // Submit -> advance -> poll against the canonical Worker routes.
  assert.match(component, /\/api\/ai\/videos\/status/);
  assert.match(component, /\/api\/ai\/videos\/generate/);
  assert.match(component, /\/advance/);
  assert.match(component, /request_id: requestId\.current/);
  // The finished video is previewed only from the member's own library,
  // through the integrity-checked download path.
  assert.match(component, /listMyMedia/);
  assert.match(component, /downloadMyMedia/);
  // Recoverable save state is a first-class UI state, not a dead end.
  assert.match(component, /provider_completed/);
  assert.match(component, /Retry saving the finished video/);
  assert.match(component, /will not be repeated/);
  // Pilot visibility: remaining free seconds are shown, with the
  // no-paid-spillover promise stated in plain words.
  assert.match(component, /Free pilot:/);
  assert.match(component, /never switches to paid generation/);
  // Honest states: failed jobs surface the provider's reason; the shared
  // creation balance is shown like the image studio shows it.
  assert.match(component, /finished\.state === "failed"/);
  assert.match(component, /TrialCreationBalance/);
  // No provider URL is ever rendered as the member's video.
  assert.doesNotMatch(component, /provider_video_url/);
  // Image-to-video: a member-supplied public image link plus an explicit
  // rights confirmation; private library images are never offered as a
  // starting image because the library has no public links.
  assert.match(component, /image_url: imageUrl\.trim\(\)/);
  assert.match(component, /rights_confirmed: rightsConfirmed/);
  assert.match(component, /I confirm this image is mine or I have the right to animate it/);
  assert.match(component, /private media library cannot be/);
});

test("videos Pages Function only forwards the canonical video routes", async () => {
  const env = {}; // nothing configured: the handler must fail closed, not fake
  const status = await onRequest({
    request: new Request("https://interplanetaryfund.com/api/ai/videos/status"),
    env,
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).videoGeneration, "not_configured");

  const generate = await onRequest({
    request: new Request("https://interplanetaryfund.com/api/ai/videos/generate", { method: "POST" }),
    env,
  });
  assert.equal(generate.status, 503);

  const foreign = await onRequest({
    request: new Request("https://interplanetaryfund.com/api/ai/videos/anything-else"),
    env,
  });
  assert.equal(foreign.status, 404);
});

test("migration for the jobs table is source-only and service-role-only", () => {
  const sql = read("../../../supabase/migrations/20261128000000_ifund_video_generation_jobs.sql");
  assert.match(sql, /SOURCE ONLY/);
  assert.match(sql, /NOT applied to production/);
  assert.match(sql, /create table if not exists public\.ifund_video_generations/);
  assert.match(sql, /revoke all on public\.ifund_video_generations from public,anon,authenticated/);
  assert.match(sql, /provider_completed/);
  assert.match(sql, /mode text not null default 'text' check\(mode in \('text','image'\)\)/);
  assert.match(sql, /rights_confirmed boolean not null default false/);
});
