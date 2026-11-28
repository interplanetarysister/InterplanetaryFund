import test from "node:test";
import assert from "node:assert/strict";
import {
  routeVideoGeneration, videoAIReady, validateVideoRequest,
  normalizeWorkersAiResult, allowanceDenial, VIDEO_MODEL,
} from "../worker/videoGeneration.js";

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
  reserveFails = false, userId = OWNER, mediaRows = [],
} = {}) {
  const calls = [];
  const jobs = new Map();
  const media = [];
  const state = { failMediaInsert: false, completeCalls: 0, reserveKinds: [] };
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
    if (url.includes("/rest/v1/ifund_video_generations")) {
      const parsed = new URL(url);
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
});

test("allowance denial states map to honest D7 statuses and copy", () => {
  assert.equal(allowanceDenial({ code: "trial_limit" })[0], 429);
  assert.equal(allowanceDenial({ code: "membership_required" })[0], 403);
  assert.equal(allowanceDenial({ code: "monthly_limit" })[0], 429);
  assert.deepEqual(allowanceDenial({ code: "unavailable" }),
    [503, "Your AI generation allowance could not be verified."]);
  assert.match(allowanceDenial({ code: "trial_limit" })[1], /15 trial AI creations/);
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
    [{ allowed: false, state: "trial_limit" }, 429, /15 trial AI creations/],
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
