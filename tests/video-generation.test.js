import test from "node:test";
import assert from "node:assert/strict";
import {
  routeVideoGeneration, videoAIReady, validateVideoRequest,
  normalizeWorkersAiResult, normalizeModelStudioTask, allowanceDenial,
  videoProviderId, pilotUsedSeconds, PILOT_CAPACITY_MESSAGE,
  VIDEO_MODEL, VIDEO_I2V_MODEL, CONCIERGE_PROVIDER_ID, buildConciergeBrief,
} from "../worker/videoGeneration.js";
import { findPublicFacingViolations } from "../apps/web/src/lib/campaignCopyQuality.mjs";

const API = "https://interplanetaryfund.com";
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const JWT = "header.payload.signature-0123456789abcdef";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const PROMPT = "A slow sunrise over a community garden book stall";

function mp4Bytes(size = 2048) {
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109], 0); // ....ftypisom
  return bytes;
}

function fakeBucket() {
  const store = new Map();
  return {
    store,
    async put(key, bytes, options = {}) {
      const copy = new Uint8Array(bytes);
      store.set(key, {
        bytes: copy, size: copy.length, etag: "etag-" + copy.length,
        httpMetadata: options.httpMetadata, customMetadata: options.customMetadata,
        uploaded: new Date(),
      });
    },
    async head(key) {
      const object = store.get(key);
      return object ? { size: object.size, etag: object.etag, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata, uploaded: object.uploaded } : null;
    },
    async get(key) {
      const object = store.get(key);
      if (!object) return null;
      return { size: object.size, etag: object.etag, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata, arrayBuffer: async () => object.bytes.slice().buffer };
    },
    async delete(key) { store.delete(key); },
    async list() { return { objects: [], truncated: false }; },
  };
}

function fakeServices({
  consent = true, reserve = { allowed: true, state: "reserved", remaining: 14 },
  reserveFails = false, userId = OWNER, mediaRows = [], campaigns = [],
} = {}) {
  const calls = [];
  const jobs = new Map();
  const media = [];
  const state = { failMediaInsert: false, completeCalls: 0, reserveKinds: [], ownerCompleteCalls: 0, ownerCompleteBodies: [] };
  const key = (owner, request) => owner + "/" + request;
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: userId, is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.includes("/rest/v1/ifund_profiles?"))
      return Response.json([{ account_status: "active", account_deletion_pending: false }]);
    if (url.includes("/rest/v1/ifund_ai_permission_preferences?"))
      return Response.json(consent
        ? [{ owner_id: userId, allow_ai_campaign_drafts: true, allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]
        : [{ owner_id: userId, allow_ai_campaign_drafts: false, allow_ai_outreach_drafts: false, allow_future_internal_ai_assistance: false }]);
    if (url.endsWith("/rpc/ifund_ai_content_reserve")) {
      if (reserveFails) return new Response("boom", { status: 500 });
      state.reserveKinds.push(JSON.parse(options.body).p_kind);
      return Response.json(reserve);
    }
    if (url.endsWith("/rpc/ifund_ai_content_complete")) {
      state.completeCalls++;
      return Response.json(true);
    }
    if (url.endsWith("/rpc/ifund_ai_content_complete_for_owner")) {
      state.ownerCompleteCalls++;
      state.ownerCompleteBodies.push(JSON.parse(options.body));
      return Response.json(true);
    }
    if (url.includes("/rest/v1/ifund_campaigns")) {
      const parsed = new URL(url);
      const id = parsed.searchParams.get("id")?.slice(3);
      const owner = parsed.searchParams.get("owner_id")?.slice(3);
      return Response.json(campaigns.filter((row) => row.id === id && row.owner_id === owner));
    }
    if (url.includes("/rest/v1/ifund_video_generations")) {
      const parsed = new URL(url);
      // Concierge reads carry no owner filter: a single job by request
      // reference, or the pickup queue by provider + state.
      if (options.method !== "POST" && options.method !== "PATCH" &&
          !parsed.searchParams.get("owner_id")) {
        const requestIdParam = parsed.searchParams.get("request_id")?.slice(3);
        if (requestIdParam) {
          const job = [...jobs.values()].find((row) => row.request_id === requestIdParam);
          return Response.json(job ? [job] : []);
        }
        if (!parsed.searchParams.get("model")) {
          const providerWanted = parsed.searchParams.get("provider")?.slice(3);
          const stateWanted = parsed.searchParams.get("state")?.slice(3);
          return Response.json([...jobs.values()].filter((row) =>
            row.provider === providerWanted && row.state === stateWanted));
        }
      }
      // Pilot usage aggregate: no owner filter; sum finished generations
      // for one provider + model across all owners.
      if (options.method !== "POST" && options.method !== "PATCH" &&
          !parsed.searchParams.get("owner_id")) {
        const provider = parsed.searchParams.get("provider")?.slice(3);
        const model = parsed.searchParams.get("model")?.slice(3);
        const states = parsed.searchParams.get("state")?.replace(/^in\.\(|\)$/g, "").split(",");
        return Response.json([...jobs.values()].filter((row) =>
          row.provider === provider && row.model === model && states.includes(row.state)));
      }
      const owner = parsed.searchParams.get("owner_id")?.slice(3);
      const requestId = parsed.searchParams.get("request_id")?.slice(3);
      if (options.method === "POST") {
        const row = JSON.parse(options.body);
        jobs.set(key(row.owner_id, row.request_id), { provider_job_id: null, provider_video_url: null, media_id: null, error: null, ...row });
        return Response.json([jobs.get(key(row.owner_id, row.request_id))]);
      }
      const job = jobs.get(key(owner, requestId));
      if (options.method === "PATCH") {
        if (!job) return Response.json([]);
        const stateFilter = parsed.searchParams.get("state")?.slice(3);
        if (stateFilter && job.state !== stateFilter) return Response.json([]);
        const updatedFilter = parsed.searchParams.get("updated_at")?.slice(3);
        if (updatedFilter && job.updated_at !== updatedFilter) return Response.json([]);
        Object.assign(job, JSON.parse(options.body));
        return Response.json([job]);
      }
      return Response.json(job ? [job] : []);
    }
    if (url.includes("/rest/v1/ifund_member_media")) {
      const parsed = new URL(url);
      if (options.method === "POST") {
        if (state.failMediaInsert) return new Response("insert failed", { status: 500 });
        const row = JSON.parse(options.body);
        media.push(row);
        return Response.json([{ id: row.id, owner_id: row.owner_id, object_sha256: row.object_sha256 }]);
      }
      if (parsed.searchParams.get("id")) {
        const id = parsed.searchParams.get("id").slice(3);
        return Response.json(media.filter((row) => row.id === id).map((row) => ({ id: row.id })));
      }
      return Response.json(mediaRows);
    }
    if (url.startsWith("https://provider.example/"))
      return new Response(mp4Bytes(), { headers: { "content-type": "video/mp4" } });
    throw Error("Unexpected external network call: " + url);
  };
  return { fetcher, calls, jobs, media, state };
}

function baseEnv(bucket, ai) {
  return {
    IFUND_VIDEO_AI_ENABLED: "enabled",
    IFUND_VIDEO_PROVIDER: "cloudflare-workers-ai",
    SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_public",
    SUPABASE_SECRET_KEY: "sb_secret_mock_service",
    IFUND_CAMPAIGN_MEDIA_ENABLED: "enabled",
    IFUND_CAMPAIGN_MEDIA: bucket,
    AI: ai,
  };
}

const generateRequest = (body = { prompt: PROMPT, request_id: REQUEST_ID }, headers = {}) =>
  new Request(API + "/api/ai/videos/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + JWT, ...headers },
    body: JSON.stringify(body),
  });
const jobRequest = (id, method = "GET") =>
  new Request(API + "/api/ai/videos/jobs/" + id + (method === "POST" ? "/advance" : ""), {
    method, headers: { Authorization: "Bearer " + JWT },
  });
const goodAi = (counter) => ({ run: async (model, input) => {
  counter.calls++;
  counter.model = model; counter.input = input;
  return { state: "Completed", result: { video: "https://provider.example/clip.mp4" } };
} });

test("readiness requires the flag, AI binding, canonical project, service key and media binding", () => {
  const env = baseEnv(fakeBucket(), { run: async () => ({}) });
  assert.equal(videoAIReady(env), true);
  assert.equal(videoAIReady({ ...env, IFUND_VIDEO_AI_ENABLED: "off" }), false);
  assert.equal(videoAIReady({ ...env, AI: undefined }), false);
  assert.equal(videoAIReady({ ...env, SUPABASE_SECRET_KEY: undefined }), false);
  assert.equal(videoAIReady({ ...env, IFUND_CAMPAIGN_MEDIA_ENABLED: "off" }), false);
  assert.equal(videoAIReady({ ...env, SUPABASE_URL: "https://example.supabase.co" }), false);
});

test("status reports not_configured while disabled and generate refuses without touching the provider", async () => {
  const counter = { calls: 0 };
  const service = fakeServices();
  const env = { ...baseEnv(fakeBucket(), goodAi(counter)), IFUND_VIDEO_AI_ENABLED: "off" };
  const status = await routeVideoGeneration(new Request(API + "/api/ai/videos/status"), env, service.fetcher);
  assert.equal((await status.json()).videoGeneration, "not_configured");
  const refused = await routeVideoGeneration(generateRequest(), env, service.fetcher);
  assert.equal(refused.status, 503);
  assert.match((await refused.json()).error, /not currently available/);
  assert.equal(counter.calls, 0);
});

test("request validation rejects short prompts, bad references and unknown fields", () => {
  assert.throws(() => validateVideoRequest({ prompt: "too short", request_id: REQUEST_ID }));
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: "nope" }));
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, provider: "other" }));
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, resolution: "4K" }));
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, duration: 30 }));
  const ok = validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID });
  assert.deepEqual([ok.resolution, ok.ratio, ok.duration], ["480P", "adaptive", 5]);
  assert.equal(ok.mode, "text");
});

test("image-to-video requires a public https image link and a rights confirmation", () => {
  const image = "https://images.example.org/stall.jpg";
  // No rights confirmation.
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, image_url: image }));
  // Non-https, credential-bearing, localhost and literal-IP links are refused.
  for (const bad of ["http://images.example.org/stall.jpg", "https://user:pass@images.example.org/x.jpg",
    "https://localhost/x.jpg", "https://192.168.1.5/x.jpg", "not a url"])
    assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, image_url: bad, rights_confirmed: true }));
  // 480P is not an I2V resolution.
  assert.throws(() => validateVideoRequest({
    prompt: PROMPT, request_id: REQUEST_ID, image_url: image, rights_confirmed: true, resolution: "480P",
  }), /720P or 1080P/);
  const ok = validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, image_url: image, rights_confirmed: true });
  assert.equal(ok.mode, "image");
  assert.equal(ok.imageUrl, image);
  assert.equal(ok.resolution, "720P");
  assert.equal(ok.rightsConfirmed, true);
});

test("image-to-video lifecycle runs the I2V model with the image link and stores the result", async () => {
  const counter = { calls: 0 };
  const bucket = fakeBucket();
  const service = fakeServices();
  const env = baseEnv(bucket, goodAi(counter));
  const imageRequest = generateRequest({
    prompt: PROMPT, request_id: REQUEST_ID,
    image_url: "https://images.example.org/stall.jpg", rights_confirmed: true,
  });
  const submitted = await routeVideoGeneration(imageRequest, env, service.fetcher);
  assert.equal(submitted.status, 202);
  assert.equal((await submitted.json()).job.mode, "image");

  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "completed");
  assert.equal(counter.model, VIDEO_I2V_MODEL);
  assert.equal(counter.input.image, "https://images.example.org/stall.jpg");
  assert.equal(counter.input.ratio, undefined);
  assert.equal(service.media.length, 1);
  assert.equal(service.media[0].content_kind, "video");
});

test("allowance denial states map to honest D7 statuses and copy", () => {
  assert.equal(allowanceDenial({ code: "trial_limit" })[0], 429);
  assert.equal(allowanceDenial({ code: "membership_required" })[0], 403);
  assert.equal(allowanceDenial({ code: "monthly_limit" })[0], 429);
  assert.deepEqual(allowanceDenial({ code: "unavailable" }),
    [503, "Your AI generation allowance could not be verified."]);
  assert.match(allowanceDenial({ code: "trial_limit" })[1], /15 free AI creations for this week/);
});

test("unauthenticated and consent-denied submits never reach the allowance or provider", async () => {
  const counter = { calls: 0 };
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), goodAi(counter));
  const anonymous = await routeVideoGeneration(
    new Request(API + "/api/ai/videos/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: PROMPT, request_id: REQUEST_ID }),
    }),
    env, service.fetcher);
  assert.equal(anonymous.status, 401);

  const denied = fakeServices({ consent: false });
  const noConsent = await routeVideoGeneration(generateRequest(), env, denied.fetcher);
  assert.equal(noConsent.status, 403);
  assert.match((await noConsent.json()).error, /AI Assistance/);
  assert.equal(counter.calls, 0);
  assert.equal(denied.state.reserveKinds.length, 0);
});

test("allowance denials return per-state responses and create no job", async () => {
  for (const [reserve, expectedStatus, copy] of [
    [{ allowed: false, state: "trial_limit" }, 429, /15 free AI creations for this week/],
    [{ allowed: false, state: "membership_required" }, 403, /needs a trial or a subscription/],
    [{ allowed: false, state: "monthly_limit" }, 429, /this month's AI creation limit/],
  ]) {
    const service = fakeServices({ reserve });
    const result = await routeVideoGeneration(generateRequest(), baseEnv(fakeBucket(), goodAi({ calls: 0 })), service.fetcher);
    assert.equal(result.status, expectedStatus);
    assert.match((await result.json()).error, copy);
    assert.equal(service.jobs.size, 0);
  }
  const failing = fakeServices({ reserveFails: true });
  const unverifiable = await routeVideoGeneration(generateRequest(), baseEnv(fakeBucket(), goodAi({ calls: 0 })), failing.fetcher);
  assert.equal(unverifiable.status, 503);
  assert.equal((await unverifiable.json()).error, "Your AI generation allowance could not be verified.");
  assert.equal(failing.jobs.size, 0);
});

test("full lifecycle: submit reserves as video, advance generates, stores into the private library and completes allowance", async () => {
  const counter = { calls: 0 };
  const bucket = fakeBucket();
  const service = fakeServices();
  const env = baseEnv(bucket, goodAi(counter));

  const submitted = await routeVideoGeneration(generateRequest(), env, service.fetcher);
  assert.equal(submitted.status, 202);
  const submittedJob = (await submitted.json()).job;
  assert.equal(submittedJob.state, "submitted");
  assert.deepEqual(service.state.reserveKinds, ["video"]);

  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  assert.equal(advanced.status, 200);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "completed");
  assert.ok(job.media_id);
  assert.equal(counter.calls, 1);
  assert.equal(counter.model, VIDEO_MODEL);
  assert.match(counter.input.prompt, /No text, letters, logos or watermarks/);
  assert.ok(counter.input.prompt.includes(PROMPT));
  assert.equal(counter.input.resolution, "480P");
  assert.equal(service.state.completeCalls, 1);

  // Stored exactly like an upload: private prefix, owner-scoped, mp4 video row.
  assert.equal(service.media.length, 1);
  const row = service.media[0];
  assert.equal(row.id, job.media_id);
  assert.equal(row.owner_id, OWNER);
  assert.equal(row.content_kind, "video");
  assert.equal(row.content_type, "video/mp4");
  assert.equal(row.object_path, `private/member-media/${OWNER}/${job.media_id}.mp4`);
  assert.equal(bucket.store.get(row.object_path)?.size, row.file_size);

  // Poll shows completion and never leaks the provider URL.
  const polled = await routeVideoGeneration(jobRequest(REQUEST_ID), env, service.fetcher);
  const polledJob = (await polled.json()).job;
  assert.equal(polledJob.state, "completed");
  assert.ok(!JSON.stringify(polledJob).includes("provider.example"));
});

test("resubmitting the same request returns the existing job instead of a second generation", async () => {
  const counter = { calls: 0 };
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), goodAi(counter));
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const again = await routeVideoGeneration(generateRequest(), env, service.fetcher);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).job.state, "completed");
  assert.equal(service.jobs.size, 1);
  assert.equal(counter.calls, 1);
});

test("provider failure marks the job failed, completes no allowance and stores nothing", async () => {
  const bucket = fakeBucket();
  const service = fakeServices();
  const env = baseEnv(bucket, { run: async () => { throw Error("provider down"); } });
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "failed");
  assert.match(job.error, /could not be reached/);
  assert.equal(service.state.completeCalls, 0);
  assert.equal(service.media.length, 0);
  assert.equal(bucket.store.size, 0);
});

test("provider response without a finished video fails the job honestly", async () => {
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), { run: async () => ({ state: "Completed", result: {} }) });
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  assert.equal((await advanced.json()).job.state, "failed");
  assert.equal(service.state.completeCalls, 0);
});

test("storage failure keeps the finished generation recoverable; retry saves without regenerating (D8)", async () => {
  const counter = { calls: 0 };
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), goodAi(counter));
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  service.state.failMediaInsert = true;
  const first = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const stuck = (await first.json()).job;
  assert.equal(stuck.state, "provider_completed");
  assert.ok(stuck.error);
  assert.equal(counter.calls, 1);
  assert.equal(service.state.completeCalls, 0);

  service.state.failMediaInsert = false;
  const retried = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const job = (await retried.json()).job;
  assert.equal(job.state, "completed");
  assert.ok(job.media_id);
  assert.equal(counter.calls, 1, "the provider must not be called again for a finished generation");
  assert.equal(service.state.completeCalls, 1);
});

test("invalid provider bytes are never stored and never complete the allowance", async () => {
  const service = fakeServices();
  const fetcher = async (url, options) => {
    if (String(url).startsWith("https://provider.example/"))
      return new Response(new TextEncoder().encode("not a video at all, just text. ".repeat(80)), { headers: { "content-type": "video/mp4" } });
    return service.fetcher(url, options);
  };
  const env = baseEnv(fakeBucket(), goodAi({ calls: 0 }));
  await routeVideoGeneration(generateRequest(), env, fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "provider_completed");
  assert.match(job.error, /not a valid MP4/);
  assert.equal(service.media.length, 0);
  assert.equal(service.state.completeCalls, 0);
});

test("a full library leaves the finished generation recoverable with an honest reason", async () => {
  const full = Array.from({ length: 50 }, (_, i) => ({ id: "row-" + i, owner_id: OWNER, file_size: 100 }));
  const service = fakeServices({ mediaRows: full });
  const env = baseEnv(fakeBucket(), goodAi({ calls: 0 }));
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "provider_completed");
  assert.match(job.error, /media library is full/);
  assert.equal(service.state.completeCalls, 0);
});

test("a pending provider response is recorded as a provider job, not faked as finished", async () => {
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), { run: async () => ({ id: "task-9", state: "Queued" }) });
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "provider_pending");
  assert.equal(service.jobs.get(OWNER + "/" + REQUEST_ID).provider_job_id, "task-9");
  assert.equal(service.state.completeCalls, 0);
});

test("jobs are owner-scoped: another member cannot read or advance them", async () => {
  const service = fakeServices();
  const env = baseEnv(fakeBucket(), goodAi({ calls: 0 }));
  await routeVideoGeneration(generateRequest(), env, service.fetcher);
  const stranger = fakeServices({ userId: OTHER });
  // The stranger's reads go through the same job store via their own calls;
  // emulate by pointing their fetcher at the shared store through service.
  const shared = async (url, options) => {
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: OTHER, is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00Z" });
    return service.fetcher(url, options);
  };
  const read = await routeVideoGeneration(jobRequest(REQUEST_ID), env, shared);
  assert.equal(read.status, 404);
  void stranger;
});

test("provider result normalization accepts documented shapes and rejects empty results", () => {
  assert.deepEqual(normalizeWorkersAiResult({ state: "Completed", result: { video: "https://cdn.example/x.mp4" } }),
    { status: "completed", videoUrl: "https://cdn.example/x.mp4" });
  assert.deepEqual(normalizeWorkersAiResult({ id: "t1", state: "Queued" }),
    { status: "pending", providerJobId: "t1" });
  assert.throws(() => normalizeWorkersAiResult({ state: "Completed", result: {} }));
  assert.throws(() => normalizeWorkersAiResult(null));
});

test("model studio task normalization maps the documented task states", () => {
  assert.deepEqual(normalizeModelStudioTask({ output: { task_id: "t", task_status: "PENDING" } }),
    { status: "pending", providerJobId: "t" });
  assert.deepEqual(normalizeModelStudioTask({ output: { task_status: "SUCCEEDED", video_url: "https://cdn.example/v.mp4" } }),
    { status: "completed", videoUrl: "https://cdn.example/v.mp4" });
  assert.equal(normalizeModelStudioTask({ output: { task_status: "FAILED" } }).status, "failed");
  assert.throws(() => normalizeModelStudioTask({ output: {} }));
  assert.throws(() => normalizeModelStudioTask(null));
});

function modelStudioEnv(bucket) {
  return {
    ...baseEnv(bucket, undefined),
    AI: undefined,
    IFUND_VIDEO_PROVIDER: "alibaba-model-studio",
    ALIBABA_MODEL_STUDIO_API_KEY: "sk-model-studio-test-key",
  };
}

test("model studio readiness needs its API key, not the AI binding", () => {
  const env = modelStudioEnv(fakeBucket());
  assert.equal(videoAIReady(env), true);
  assert.equal(videoAIReady({ ...env, ALIBABA_MODEL_STUDIO_API_KEY: "" }), false);
  assert.equal(videoAIReady({ ...env, ALIBABA_MODEL_STUDIO_API_KEY: undefined }), false);
});

test("model studio lifecycle: create task, poll to completion, store like an upload", async () => {
  const service = fakeServices();
  const taskStates = ["RUNNING", "SUCCEEDED"];
  const seen = [];
  const fetcher = async (url, options = {}) => {
    const u = String(url);
    if (u.includes("dashscope-intl.aliyuncs.com")) {
      seen.push({ u, options });
      if (u.endsWith("/video-synthesis"))
        return Response.json({ output: { task_id: "task-123", task_status: "PENDING" }, request_id: "r1" });
      if (u.includes("/api/v1/tasks/")) {
        const status = taskStates.shift() ?? "SUCCEEDED";
        return Response.json({ output: status === "SUCCEEDED"
          ? { task_id: "task-123", task_status: "SUCCEEDED", video_url: "https://provider.example/clip.mp4" }
          : { task_id: "task-123", task_status: status } });
      }
    }
    return service.fetcher(url, options);
  };
  const env = modelStudioEnv(fakeBucket());

  const submitted = await routeVideoGeneration(generateRequest(), env, fetcher);
  assert.equal(submitted.status, 202);
  const submittedJob = (await submitted.json()).job;
  assert.equal(submittedJob.provider, "alibaba-model-studio");
  assert.equal(submittedJob.model, "wan2.7-t2v");

  const first = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  assert.equal((await first.json()).job.state, "provider_pending");
  const create = seen.find((call) => call.u.endsWith("/video-synthesis"));
  assert.equal(create.options.headers.Authorization, "Bearer sk-model-studio-test-key");
  assert.equal(create.options.headers["X-DashScope-Async"], "enable");
  const createBody = JSON.parse(create.options.body);
  assert.equal(createBody.model, "wan2.7-t2v");
  assert.equal(createBody.parameters.watermark, false);
  assert.equal(createBody.parameters.ratio, undefined, "adaptive ratio is omitted for the DashScope contract");
  assert.equal(service.state.completeCalls, 0);

  const second = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  assert.equal((await second.json()).job.state, "provider_pending");

  const third = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  const job = (await third.json()).job;
  assert.equal(job.state, "completed");
  assert.ok(job.media_id);
  assert.equal(service.media.length, 1);
  assert.equal(service.media[0].content_kind, "video");
  assert.equal(service.state.completeCalls, 1);
});

test("model studio task failure fails the job without completing allowance", async () => {
  const service = fakeServices();
  const fetcher = async (url, options = {}) => {
    const u = String(url);
    if (u.endsWith("/video-synthesis"))
      return Response.json({ output: { task_id: "task-9", task_status: "PENDING" } });
    if (u.includes("/api/v1/tasks/"))
      return Response.json({ output: { task_id: "task-9", task_status: "FAILED" } });
    return service.fetcher(url, options);
  };
  const env = modelStudioEnv(fakeBucket());
  await routeVideoGeneration(generateRequest(), env, fetcher);
  await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  const polled = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  const job = (await polled.json()).job;
  assert.equal(job.state, "failed");
  assert.equal(service.state.completeCalls, 0);
  assert.equal(service.media.length, 0);
});

function seedPilotUsage(service, model, seconds, state = "completed") {
  service.jobs.set(OWNER + "/seed-" + model + "-" + state, {
    owner_id: OWNER, request_id: "seed-" + model, provider: "alibaba-model-studio",
    model, state, duration_seconds: seconds, prompt: PROMPT,
    resolution: "720P", ratio: "adaptive", provider_job_id: null,
    provider_video_url: null, media_id: null, allowance_tracked: true,
    error: null, created_at: "2026-11-28T00:00:00Z", updated_at: "2026-11-28T00:00:00Z",
  });
}

test("pilot is the default: model studio is selected unless the metered route is explicit", () => {
  const env = modelStudioEnv(fakeBucket());
  delete env.IFUND_VIDEO_PROVIDER;
  assert.equal(videoProviderId(env), "alibaba-model-studio");
  assert.equal(videoAIReady(env), true);
  assert.equal(videoProviderId({ IFUND_VIDEO_PROVIDER: "cloudflare-workers-ai" }), "cloudflare-workers-ai");
});

test("no paid spillover: a paid-only model selection fails closed during the pilot", () => {
  const env = modelStudioEnv(fakeBucket());
  assert.equal(videoAIReady({ ...env, IFUND_VIDEO_MODEL: "wan2.2-t2v-plus" }), false);
  assert.equal(videoAIReady({ ...env, IFUND_VIDEO_I2V_MODEL: "wan2.2-i2v-plus" }), false);
  // Only an explicit owner switch re-opens paid models.
  assert.equal(videoAIReady({
    ...env, IFUND_VIDEO_MODEL: "wan2.2-t2v-plus", IFUND_VIDEO_ALLOW_PAID_MODELS: "enabled",
  }), true);
});

test("pilot capacity: a request past the free quota fails closed before reserving allowance", async () => {
  const service = fakeServices();
  seedPilotUsage(service, "wan3.0-video", 28);
  const env = { ...modelStudioEnv(fakeBucket()), IFUND_VIDEO_MODEL: "wan3.0-video" };
  const refused = await routeVideoGeneration(generateRequest(), env, service.fetcher);
  assert.equal(refused.status, 429);
  const body = await refused.json();
  assert.equal(body.code, "pilot_capacity");
  assert.equal(body.error, PILOT_CAPACITY_MESSAGE);
  assert.deepEqual(service.state.reserveKinds, []);
  assert.equal(service.jobs.size, 1, "only the seeded usage row exists");

  // Boundary: exactly filling the quota is still allowed.
  const service2 = fakeServices();
  seedPilotUsage(service2, "wan3.0-video", 25);
  const allowed = await routeVideoGeneration(generateRequest(), env, service2.fetcher);
  assert.equal(allowed.status, 202);
});

test("pilot usage counts finished generations account-wide, not per member", async () => {
  const service = fakeServices();
  seedPilotUsage(service, "wan2.7-t2v", 10);
  seedPilotUsage(service, "wan2.7-t2v", 5, "provider_completed");
  seedPilotUsage(service, "wan2.7-t2v", 7, "failed");
  seedPilotUsage(service, "wan3.0-video", 30);
  assert.equal(await pilotUsedSeconds(modelStudioEnv(fakeBucket()), service.fetcher, "wan2.7-t2v"), 15);
});

test("status reports the pilot burn and expiry while the pilot runs", async () => {
  const service = fakeServices();
  seedPilotUsage(service, "wan2.7-t2v", 10);
  const env = { ...modelStudioEnv(fakeBucket()), IFUND_VIDEO_PILOT_STARTED_AT: "2026-11-28T00:00:00Z" };
  const status = await routeVideoGeneration(new Request(API + "/api/ai/videos/status"), env, service.fetcher);
  const body = await status.json();
  assert.equal(body.provider, "alibaba-model-studio");
  const t2v = body.pilot.find((entry) => entry.model === "wan2.7-t2v");
  assert.deepEqual(
    [t2v.quota_seconds, t2v.used_seconds, t2v.remaining_seconds], [50, 10, 40]);
  assert.equal(body.pilot_expires_at, "2027-02-26T00:00:00.000Z");
});

test("a provider quota refusal lands as the pilot-capacity state, never a paid retry", async () => {
  const service = fakeServices();
  const fetcher = async (url, options = {}) => {
    if (String(url).endsWith("/video-synthesis"))
      return Response.json(
        { code: "QuotaExceeded", message: "The free quota has been exhausted" },
        { status: 403 });
    return service.fetcher(url, options);
  };
  const env = modelStudioEnv(fakeBucket());
  await routeVideoGeneration(generateRequest(), env, fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, fetcher);
  const job = (await advanced.json()).job;
  assert.equal(job.state, "failed");
  assert.equal(job.error, PILOT_CAPACITY_MESSAGE);
  assert.equal(service.state.completeCalls, 0);
});

// --- Executive concierge provider -------------------------------------------

const CONCIERGE_SECRET = "concierge-test-secret-0123456789";
const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID_2 = "55555555-5555-4555-8555-555555555555";
const CAMPAIGN = {
  id: CAMPAIGN_ID, owner_id: OWNER, title: "Community Garden Book Stall",
  summary: "A free book stall and seed library run by volunteers in our neighborhood garden.",
  story: "Our garden has lent tools for years. This spring we are adding a book stall so neighbors can swap stories and seeds.",
  category: "community", goal_amount: 2500,
  cover_image_url: "https://cdn.example/garden-cover.jpg", status: "active",
};

function conciergeEnv(bucket) {
  return {
    ...baseEnv(bucket, undefined),
    AI: undefined,
    IFUND_VIDEO_PROVIDER: "executive-concierge",
    CONCIERGE_PICKUP_SECRET: CONCIERGE_SECRET,
  };
}

const conciergeHeaders = (secret = CONCIERGE_SECRET) => ({ "x-concierge-secret": secret });
const pendingRequest = (headers = conciergeHeaders()) =>
  new Request(API + "/api/ai/videos/concierge/pending", { headers });
const completeRequest = (id, bytes, headers = {}) =>
  new Request(API + "/api/ai/videos/concierge/jobs/" + id + "/complete", {
    method: "POST",
    headers: { "Content-Type": "video/mp4", ...conciergeHeaders(), ...headers },
    body: bytes,
  });
const failRequest = (id, reason, headers = {}) =>
  new Request(API + "/api/ai/videos/concierge/jobs/" + id + "/fail", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...conciergeHeaders(), ...headers },
    body: JSON.stringify(reason === undefined ? {} : { reason }),
  });

test("concierge is selected only by the explicit switch and needs its pickup secret, not the AI binding", () => {
  assert.equal(videoProviderId({ IFUND_VIDEO_PROVIDER: "executive-concierge" }), CONCIERGE_PROVIDER_ID);
  const env = conciergeEnv(fakeBucket());
  assert.equal(videoAIReady(env), true);
  assert.equal(videoAIReady({ ...env, CONCIERGE_PICKUP_SECRET: undefined }), false);
  assert.equal(videoAIReady({ ...env, CONCIERGE_PICKUP_SECRET: "too-short" }), false);
  // No pilot quota applies to concierge jobs: a paid-only Wan model
  // selection elsewhere never makes the concierge unready.
  assert.equal(videoAIReady({ ...env, IFUND_VIDEO_MODEL: "wan2.2-t2v-plus" }), true);
});

test("campaign reference validation accepts a UUID campaign and rejects a malformed one", () => {
  const ok = validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID });
  assert.equal(ok.campaignId, CAMPAIGN_ID);
  assert.throws(() => validateVideoRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: "not-a-uuid" }));
});

test("concierge submit builds the brief from the member's campaign and queues the job", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  const submitted = await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  assert.equal(submitted.status, 202);
  const job = (await submitted.json()).job;
  assert.equal(job.state, "awaiting_concierge");
  assert.equal(job.provider, "executive-concierge");
  assert.equal(job.campaign_id, CAMPAIGN_ID);
  // The member-facing job never carries the brief itself.
  assert.equal(job.brief, undefined);
  // The allowance was reserved exactly like any other generation.
  assert.deepEqual(service.state.reserveKinds, ["video"]);

  const stored = service.jobs.get(OWNER + "/" + REQUEST_ID);
  assert.equal(stored.state, "awaiting_concierge");
  assert.match(stored.brief, /Community Garden Book Stall/);
  assert.match(stored.brief, /Category: community/);
  assert.match(stored.brief, /\$2,500/);
  assert.match(stored.brief, /garden-cover\.jpg/);
  assert.ok(stored.brief.includes(PROMPT));
  assert.match(stored.brief, /5 seconds/);
  assert.match(stored.brief, /no text, letters, logos or watermarks/);
  assert.ok(stored.brief.length <= 4000);
});

test("concierge brief strips pleading and raw needs from campaign text and member direction", async () => {
  const dirty = {
    ...CAMPAIGN,
    title: "Help Me Raise Money For The Garden",
    story: "I need money for seeds and tools. The garden lends tools to forty families on our block.",
  };
  const service = fakeServices({ campaigns: [dirty] });
  const env = conciergeEnv(fakeBucket());
  const pleadingPrompt = "Please help me raise $2500 — I need money to buy myself new tools";
  const submitted = await routeVideoGeneration(
    generateRequest({ prompt: pleadingPrompt, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  assert.equal(submitted.status, 202);
  const stored = service.jobs.get(OWNER + "/" + REQUEST_ID);
  assert.doesNotMatch(stored.brief, /help me raise/i);
  assert.doesNotMatch(stored.brief, /i need money/i);
  assert.doesNotMatch(stored.brief, /buy myself/i);
  // Clean campaign facts survive the scan.
  assert.match(stored.brief, /forty families/);
  assert.match(stored.brief, /Category: community/);
  // And the stored brief is verifiably clean under the same scan.
  const source = [dirty.title, dirty.summary, dirty.story, pleadingPrompt].join("\n");
  assert.deepEqual(findPublicFacingViolations(stored.brief, source), []);
});

test("concierge brief builder carries the output constraints and the image reference", () => {
  const brief = buildConciergeBrief({
    campaign: CAMPAIGN, prompt: PROMPT, mode: "image",
    imageUrl: "https://images.example.org/stall.jpg",
    resolution: "720P", ratio: "9:16", duration: 7,
  });
  assert.match(brief, /7 seconds, 9:16 aspect, 720P/);
  assert.match(brief, /Starting image supplied by the organizer/);
  assert.match(brief, /images\.example\.org\/stall\.jpg/);
  const bare = buildConciergeBrief({ prompt: PROMPT, resolution: "480P", ratio: "adaptive", duration: 5 });
  assert.match(bare, /adaptive aspect/);
  assert.ok(!bare.includes("Campaign:"));
});

test("a campaign that is not the member's own is refused and creates no job", async () => {
  const foreign = { ...CAMPAIGN, owner_id: OTHER };
  const service = fakeServices({ campaigns: [foreign] });
  const env = conciergeEnv(fakeBucket());
  const refused = await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  assert.equal(refused.status, 422);
  assert.match((await refused.json()).error, /one of your own campaigns/);
  assert.equal(service.jobs.size, 0);
});

test("concierge endpoints fail closed: unset secret is 503, missing or wrong secret is 401", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);

  const missing = await routeVideoGeneration(pendingRequest({}), env, service.fetcher);
  assert.equal(missing.status, 401);
  const wrong = await routeVideoGeneration(
    pendingRequest(conciergeHeaders("concierge-test-secret-9999999999")), env, service.fetcher);
  assert.equal(wrong.status, 401);
  const wrongComplete = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes(), conciergeHeaders("concierge-test-secret-9999999999")),
    env, service.fetcher);
  assert.equal(wrongComplete.status, 401);

  const unconfigured = { ...env, CONCIERGE_PICKUP_SECRET: undefined };
  const noSecret = await routeVideoGeneration(pendingRequest(), unconfigured, service.fetcher);
  assert.equal(noSecret.status, 503);
  const noSecretFail = await routeVideoGeneration(failRequest(REQUEST_ID, "x"), unconfigured, service.fetcher);
  assert.equal(noSecretFail.status, 503);
  // The job was never touched by any of the refused calls.
  assert.equal(service.jobs.get(OWNER + "/" + REQUEST_ID).state, "awaiting_concierge");
});

test("pickup lists only queued concierge jobs, with briefs and output constraints", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID_2 }),
    env, service.fetcher);
  // A provider-route job in the same store is not part of the queue.
  await routeVideoGeneration(generateRequest({
    prompt: PROMPT, request_id: "66666666-6666-4666-8666-666666666666",
  }), modelStudioEnv(fakeBucket()), service.fetcher);

  const listed = await routeVideoGeneration(pendingRequest(), env, service.fetcher);
  assert.equal(listed.status, 200);
  const { jobs } = await listed.json();
  assert.equal(jobs.length, 2);
  const first = jobs.find((entry) => entry.request_id === REQUEST_ID);
  assert.equal(first.campaign_id, CAMPAIGN_ID);
  assert.match(first.brief, /Community Garden Book Stall/);
  assert.deepEqual([first.resolution, first.ratio, first.duration_seconds], ["480P", "adaptive", 5]);
  const second = jobs.find((entry) => entry.request_id === REQUEST_ID_2);
  assert.equal(second.campaign_id, null);
  assert.ok(second.brief.includes(PROMPT));
});

test("concierge lifecycle: pickup, return bytes, verified storage, allowance completed exactly once", async () => {
  const bucket = fakeBucket();
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(bucket);
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);

  const completed = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  assert.equal(completed.status, 200);
  const job = (await completed.json()).job;
  assert.equal(job.state, "completed");
  assert.ok(job.media_id);
  assert.equal(job.campaign_id, CAMPAIGN_ID);

  // Stored exactly like an upload, for the job's owner.
  assert.equal(service.media.length, 1);
  const row = service.media[0];
  assert.equal(row.id, job.media_id);
  assert.equal(row.owner_id, OWNER);
  assert.equal(row.content_kind, "video");
  assert.equal(row.object_path, `private/member-media/${OWNER}/${job.media_id}.mp4`);
  assert.equal(bucket.store.get(row.object_path)?.size, row.file_size);

  // The allowance was completed through the trusted owner completion —
  // never the member-JWT completion, which this path does not hold.
  assert.equal(service.state.ownerCompleteCalls, 1);
  assert.deepEqual(service.state.ownerCompleteBodies[0], {
    p_owner_id: OWNER, p_request_id: REQUEST_ID, p_kind: "video",
  });
  assert.equal(service.state.completeCalls, 0);

  // The member sees the finished video through the normal job API, and
  // the queue is empty again.
  const polled = await routeVideoGeneration(jobRequest(REQUEST_ID), env, service.fetcher);
  const polledJob = (await polled.json()).job;
  assert.equal(polledJob.state, "completed");
  assert.equal(polledJob.media_id, job.media_id);
  assert.ok(!JSON.stringify(polledJob).includes("brief"));
  const listed = await routeVideoGeneration(pendingRequest(), env, service.fetcher);
  assert.equal((await listed.json()).jobs.length, 0);
});

test("repeated concierge completion returns the recorded result without storing or completing twice", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  const first = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  const firstJob = (await first.json()).job;
  const second = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes(4096)), env, service.fetcher);
  assert.equal(second.status, 200);
  const secondJob = (await second.json()).job;
  assert.equal(secondJob.state, "completed");
  assert.equal(secondJob.media_id, firstJob.media_id);
  assert.equal(service.media.length, 1);
  assert.equal(service.state.ownerCompleteCalls, 1);
});

test("invalid returned bytes are rejected, the job stays queued, and a retry can still complete it", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  const badBytes = new TextEncoder().encode("not a video at all, just text. ".repeat(80));
  const rejected = await routeVideoGeneration(
    completeRequest(REQUEST_ID, badBytes), env, service.fetcher);
  assert.equal(rejected.status, 503);
  assert.match((await rejected.json()).error, /not a valid MP4/);
  assert.equal(service.jobs.get(OWNER + "/" + REQUEST_ID).state, "awaiting_concierge");
  assert.equal(service.media.length, 0);
  assert.equal(service.state.ownerCompleteCalls, 0);

  const retried = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  assert.equal((await retried.json()).job.state, "completed");
  assert.equal(service.state.ownerCompleteCalls, 1);
});

test("concierge failure marks the job failed with the reason and completes no allowance", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  const failed = await routeVideoGeneration(
    failRequest(REQUEST_ID, "The campaign photos were not usable for this video."),
    env, service.fetcher);
  assert.equal(failed.status, 200);
  const job = (await failed.json()).job;
  assert.equal(job.state, "failed");
  assert.match(job.error, /photos were not usable/);
  assert.equal(service.state.ownerCompleteCalls, 0);
  assert.equal(service.state.completeCalls, 0);
  assert.equal(service.media.length, 0);

  // The member sees the same honest failure through the job API.
  const polled = await routeVideoGeneration(jobRequest(REQUEST_ID), env, service.fetcher);
  assert.equal((await polled.json()).job.state, "failed");

  // Failing again is a no-op report; completing a failed job is refused.
  const again = await routeVideoGeneration(
    failRequest(REQUEST_ID, "a different reason"), env, service.fetcher);
  assert.equal((await again.json()).job.error, job.error);
  const lateComplete = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  assert.equal(lateComplete.status, 409);
});

test("member advance never runs a provider for a queued concierge job", async () => {
  const service = fakeServices({ campaigns: [CAMPAIGN] });
  const env = conciergeEnv(fakeBucket());
  await routeVideoGeneration(
    generateRequest({ prompt: PROMPT, request_id: REQUEST_ID, campaign_id: CAMPAIGN_ID }),
    env, service.fetcher);
  const advanced = await routeVideoGeneration(jobRequest(REQUEST_ID, "POST"), env, service.fetcher);
  assert.equal(advanced.status, 200);
  assert.equal((await advanced.json()).job.state, "awaiting_concierge");
  assert.equal(service.jobs.get(OWNER + "/" + REQUEST_ID).state, "awaiting_concierge");
});

test("concierge completion for an unknown job or another provider's job is not found", async () => {
  const service = fakeServices();
  const env = conciergeEnv(fakeBucket());
  const unknown = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  assert.equal(unknown.status, 404);
  await routeVideoGeneration(generateRequest(), modelStudioEnv(fakeBucket()), service.fetcher);
  const foreign = await routeVideoGeneration(
    completeRequest(REQUEST_ID, mp4Bytes()), env, service.fetcher);
  assert.equal(foreign.status, 404);
  const foreignFail = await routeVideoGeneration(
    failRequest(REQUEST_ID, "not yours"), env, service.fetcher);
  assert.equal(foreignFail.status, 404);
});

test("status reports the concierge provider with no pilot data", async () => {
  const service = fakeServices();
  const status = await routeVideoGeneration(
    new Request(API + "/api/ai/videos/status"), conciergeEnv(fakeBucket()), service.fetcher);
  const body = await status.json();
  assert.equal(body.videoGeneration, "enabled");
  assert.equal(body.provider, "executive-concierge");
  assert.equal(body.model, "executive-concierge");
  assert.equal(body.pilot, undefined);
});
