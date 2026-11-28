// AI video generation for the Media Studio. The repo names no external
// video provider and no second credential vault exists; the platform's AI
// provider everywhere else is Cloudflare Workers AI, whose catalog carries
// the Alibaba Wan text-to-video model — so Wan is the wired model family,
// behind a provider-swappable adapter (see createVideoProvider):
//   - 'cloudflare-workers-ai' (default): Wan via the existing AI binding.
//   - 'alibaba-model-studio': Wan direct via the DashScope async API,
//     whose new-account free quotas are the only real free API seconds
//     for video (one-time, ~90 days — provider research 2026-11-28).
// The feature stays behind IFUND_VIDEO_AI_ENABLED (default off) because
// every route to a video model is billed per generated second — none is
// covered by the free daily Neuron allocation that covers the text/image
// models — so enabling it is an explicit owner budget/quota decision,
// exactly like the image studio's flag. While disabled or incompletely
// configured every route reports an honest not-configured state instead
// of faking a generation.
//
// Lifecycle (durable job row per request, table ifund_video_generations):
//   POST /api/ai/videos/generate        reserve allowance + create job
//   POST /api/ai/videos/jobs/:id/advance run provider, download, store
//   GET  /api/ai/videos/jobs/:id         poll the job state
//   GET  /api/ai/videos/status           public enabled/not-configured flag
// Two generative modes, both true AI generation (never assembly of member
// footage): 'text' is text-to-video (Wan 3.0); 'image' is image-to-video
// (Wan 2.7 I2V) from a member-supplied PUBLIC image URL with a recorded
// rights confirmation. The I2V model accepts only an image URL, and Phase
// 1 private library media never gets a public URL, so library images are
// deliberately not an I2V source.
// A finished provider generation is never discarded: its result URL is
// recorded on the job (state provider_completed) BEFORE storage is
// attempted, and a storage failure leaves the job in that recoverable
// state so Advance can retry storage without calling — or paying — the
// provider twice (the D8 lesson from image generation). Allowance is
// completed only after the video is verified inside the member's private
// media library, through the same Phase 1 pipeline as an upload
// (storeMemberMediaBytes), so the result is attachable and playable
// exactly like an uploaded video.
import { response } from './reads.js';
import { verifyOwnerAIConsent } from './aiConsent.js';
import { reserveTrialContent, completeTrialContent } from './trialAiContent.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { UUID, fail, supabase, member } from './media/privateDocuments.js';
import { storeMemberMediaBytes, memberMediaSignature } from './media/memberMedia.js';

export const VIDEO_MODEL = 'alibaba/wan-3.0';
export const VIDEO_I2V_MODEL = 'alibaba/wan-2.7-i2v';
export const VIDEO_PROVIDER_ID = 'cloudflare-workers-ai';
export const MODEL_STUDIO_PROVIDER_ID = 'alibaba-model-studio';
export const MODEL_STUDIO_T2V_MODEL = 'wan2.7-t2v';
export const MODEL_STUDIO_I2V_MODEL = 'wan2.5-i2v-preview';
export const MODEL_STUDIO_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com';
export const VIDEO_RESOLUTIONS = Object.freeze(['480P', '720P', '1080P']);
export const VIDEO_I2V_RESOLUTIONS = Object.freeze(['720P', '1080P']);
export const VIDEO_RATIOS = Object.freeze(['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4']);
const CANONICAL_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';
const JOBS = '/rest/v1/ifund_video_generations';
const JOB_SELECT = 'owner_id,request_id,provider,model,state,prompt,resolution,ratio,duration_seconds,mode,image_url,rights_confirmed,provider_job_id,provider_video_url,media_id,allowance_tracked,error,created_at,updated_at';
const MAX_VIDEO_BYTES = 41943040; // member-media video cap (memberMedia.js)
const MIN_VIDEO_BYTES = 1024;
const RUNNING_STALE_MS = 10 * 60 * 1000;
const PROMPT_PREFIX = 'Original short promotional video for a personal fundraiser. ' +
  'No text, letters, logos or watermarks anywhere in the video. Do not depict real ' +
  'people, claimed donations, or fundraising totals. Scene: ';

export class VideoProviderError extends Error {}

export function videoModel(env) {
  return typeof env?.IFUND_VIDEO_MODEL === 'string' && env.IFUND_VIDEO_MODEL.trim()
    ? env.IFUND_VIDEO_MODEL.trim() : VIDEO_MODEL;
}

export function videoI2vModel(env) {
  return typeof env?.IFUND_VIDEO_I2V_MODEL === 'string' && env.IFUND_VIDEO_I2V_MODEL.trim()
    ? env.IFUND_VIDEO_I2V_MODEL.trim() : VIDEO_I2V_MODEL;
}

// The adapter is provider-swappable: IFUND_VIDEO_PROVIDER selects which
// concrete adapter serves generation. Both adapters target the Alibaba
// Wan family — via the Workers AI binding, or directly against Alibaba
// Model Studio (DashScope), whose new-account free quotas are the only
// real free API seconds found for video (one-time, ~90 days; see
// docs/product/IFUND_VIDEO_GENERATION_PROVIDER_20261128.md). The standing
// provider after those quotas is an owner decision, not a code default.
export function videoProviderId(env) {
  return env?.IFUND_VIDEO_PROVIDER === MODEL_STUDIO_PROVIDER_ID
    ? MODEL_STUDIO_PROVIDER_ID : VIDEO_PROVIDER_ID;
}

export function providerModel(env, providerId, mode) {
  // IFUND_VIDEO_MODEL / IFUND_VIDEO_I2V_MODEL override the model for
  // whichever provider is active; defaults are per provider and mode.
  const override = mode === 'image' ? env?.IFUND_VIDEO_I2V_MODEL : env?.IFUND_VIDEO_MODEL;
  if (typeof override === 'string' && override.trim()) return override.trim();
  if (providerId === MODEL_STUDIO_PROVIDER_ID)
    return mode === 'image' ? MODEL_STUDIO_I2V_MODEL : MODEL_STUDIO_T2V_MODEL;
  return mode === 'image' ? VIDEO_I2V_MODEL : VIDEO_MODEL;
}

function modelStudioKey(env) {
  return typeof env?.ALIBABA_MODEL_STUDIO_API_KEY === 'string'
    ? env.ALIBABA_MODEL_STUDIO_API_KEY.trim() : '';
}

function modelStudioBaseUrl(env) {
  const base = typeof env?.ALIBABA_MODEL_STUDIO_BASE_URL === 'string' &&
    env.ALIBABA_MODEL_STUDIO_BASE_URL.trim()
    ? env.ALIBABA_MODEL_STUDIO_BASE_URL.trim() : MODEL_STUDIO_DEFAULT_BASE_URL;
  return base.replace(/\/$/, '');
}

export function videoAIReady(env) {
  const common = env?.IFUND_VIDEO_AI_ENABLED === 'enabled' &&
    env.SUPABASE_URL === CANONICAL_URL &&
    typeof env.SUPABASE_PUBLISHABLE_KEY === 'string' &&
    env.SUPABASE_PUBLISHABLE_KEY.length >= 10 &&
    typeof env.SUPABASE_SECRET_KEY === 'string' &&
    env.SUPABASE_SECRET_KEY.length >= 10 &&
    env.IFUND_CAMPAIGN_MEDIA_ENABLED === 'enabled' &&
    typeof env.IFUND_CAMPAIGN_MEDIA?.put === 'function' &&
    typeof env.IFUND_CAMPAIGN_MEDIA?.get === 'function' &&
    typeof env.IFUND_CAMPAIGN_MEDIA?.head === 'function' &&
    typeof env.IFUND_CAMPAIGN_MEDIA?.delete === 'function';
  if (!common) return false;
  // Provider-specific credential: the Workers AI binding, or the Model
  // Studio API key. Without the selected provider's credential the
  // feature reports itself unconfigured rather than faking success.
  return videoProviderId(env) === MODEL_STUDIO_PROVIDER_ID
    ? modelStudioKey(env).length >= 10
    : typeof env?.AI?.run === 'function';
}

/**
 * Provider adapter contract. An adapter exposes:
 *   submit(input) -> { status:'completed', videoUrl }
 *                  | { status:'pending', providerJobId }
 *   poll(providerJobId) -> the same shapes, or { status:'failed', error }
 * Provider failures throw VideoProviderError with member-safe copy; the
 * allowance is never completed for a failed provider call.
 * createVideoProvider selects the concrete adapter: the job's own
 * provider when one is recorded, otherwise the configured provider.
 */
export function createVideoProvider(env, fetcher = fetch, providerId = videoProviderId(env)) {
  if (providerId === MODEL_STUDIO_PROVIDER_ID) {
    const key = modelStudioKey(env);
    if (!key) return null;
    const base = modelStudioBaseUrl(env);
    const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    return {
      id: MODEL_STUDIO_PROVIDER_ID,
      model: providerModel(env, MODEL_STUDIO_PROVIDER_ID, 'text'),
      i2vModel: providerModel(env, MODEL_STUDIO_PROVIDER_ID, 'image'),
      async submit(input) {
        // Alibaba Model Studio (DashScope) async video synthesis:
        // create a task, then poll it. Contract per Alibaba's Wan
        // text-to-video API reference (verified 2026-11-28).
        const imageMode = typeof input?.image === 'string' && input.image.length > 0;
        const body = {
          model: providerModel(env, MODEL_STUDIO_PROVIDER_ID, imageMode ? 'image' : 'text'),
          input: {
            prompt: input.prompt,
            ...(imageMode ? { img_url: input.image } : {}),
          },
          parameters: {
            resolution: input.resolution,
            ...(input.ratio && input.ratio !== 'adaptive' ? { ratio: input.ratio } : {}),
            duration: input.duration,
            watermark: false,
          },
        };
        let data;
        try {
          const res = await fetcher(base + '/api/v1/services/aigc/video-generation/video-synthesis', {
            method: 'POST',
            headers: { ...headers, 'X-DashScope-Async': 'enable' },
            body: JSON.stringify(body),
          });
          data = await res.json().catch(() => null);
          if (!res.ok) throw new Error('provider http ' + res.status);
        } catch {
          throw new VideoProviderError('The video provider could not be reached. No finished video was produced, so this attempt does not count as a completed creation.');
        }
        return normalizeModelStudioTask(data);
      },
      async poll(providerJobId) {
        let data;
        try {
          const res = await fetcher(base + '/api/v1/tasks/' + encodeURIComponent(providerJobId), {
            headers,
          });
          data = await res.json().catch(() => null);
          if (!res.ok) throw new Error('provider http ' + res.status);
        } catch {
          throw new VideoProviderError('The video provider could not be reached to check this generation.');
        }
        return normalizeModelStudioTask(data);
      },
    };
  }
  if (typeof env?.AI?.run !== 'function') return null;
  const model = providerModel(env, VIDEO_PROVIDER_ID, 'text');
  const i2vModel = providerModel(env, VIDEO_PROVIDER_ID, 'image');
  return {
    id: VIDEO_PROVIDER_ID,
    model,
    i2vModel,
    async submit(input) {
      // Image-to-video runs on the provider's I2V model with the image
      // URL as the reference frame; text-to-video uses the text model.
      const imageMode = typeof input?.image === 'string' && input.image.length > 0;
      const payload = imageMode
        ? { image: input.image, prompt: input.prompt, resolution: input.resolution, duration: input.duration }
        : input;
      let result;
      try {
        result = await env.AI.run(imageMode ? i2vModel : model, payload);
      } catch {
        throw new VideoProviderError('The video provider could not be reached. No finished video was produced, so this attempt does not count as a completed creation.');
      }
      return normalizeWorkersAiResult(result);
    },
    async poll() {
      // The Workers AI binding call resolves with the finished result (see
      // the model page's binding example), so this adapter never returns a
      // pending job and has nothing to poll. Async providers return
      // { status:'pending', providerJobId } from submit and answer here.
      throw new VideoProviderError('This video provider has no separate job to poll.');
    },
  };
}

export function normalizeModelStudioTask(data) {
  const output = data?.output;
  const status = typeof output?.task_status === 'string' ? output.task_status : '';
  if (status === 'SUCCEEDED' &&
      typeof output?.video_url === 'string' && /^https:\/\/[^\s]+$/i.test(output.video_url))
    return { status: 'completed', videoUrl: output.video_url };
  if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN')
    return { status: 'failed', error: 'The video provider could not finish this generation. This attempt does not count as a completed creation.' };
  if ((status === 'PENDING' || status === 'RUNNING') && output?.task_id)
    return { status: 'pending', providerJobId: String(output.task_id) };
  throw new VideoProviderError('The video provider did not return a finished video. No finished video was produced, so this attempt does not count as a completed creation.');
}

export function normalizeWorkersAiResult(result) {
  const video = result?.result?.video ?? result?.video;
  if (typeof video === 'string' && /^https:\/\/[^\s]+$/i.test(video))
    return { status: 'completed', videoUrl: video };
  const providerJobId = result?.id ?? result?.task_id ?? result?.result?.id;
  if (providerJobId && !/complete/i.test(String(result?.state || '')))
    return { status: 'pending', providerJobId: String(providerJobId) };
  throw new VideoProviderError('The video provider did not return a finished video. No finished video was produced, so this attempt does not count as a completed creation.');
}

// The I2V model takes its reference image as a URL, so the source must be
// a public https link the member supplies — never a private library
// object (Phase 1 mints no public URL for those) and never a local or
// literal-IP address the provider would fetch server-side.
function validateImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048)
    throw new BodyError(422, 'Give a public https link to the starting image.');
  let parsed;
  try { parsed = new URL(value); } catch {
    throw new BodyError(422, 'Give a public https link to the starting image.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local') ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) || parsed.hostname.includes(':'))
    throw new BodyError(422, 'Give a public https link to the starting image.');
  return parsed.toString();
}

export function validateVideoRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['prompt', 'resolution', 'ratio', 'duration', 'request_id', 'image_url', 'rights_confirmed'].includes(key)))
    throw new BodyError(422, 'Describe the video you want to generate.');
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (prompt.length < 20 || prompt.length > 900 || /[\u0000-\u001f\u007f]/.test(prompt))
    throw new BodyError(422, 'Describe the video in 20 to 900 characters.');
  const imageUrl = input.image_url === undefined || input.image_url === null || input.image_url === ''
    ? null : validateImageUrl(input.image_url);
  const mode = imageUrl ? 'image' : 'text';
  if (mode === 'image' && input.rights_confirmed !== true)
    throw new BodyError(422, 'Confirm you have the right to animate that image before generating.');
  const resolution = input.resolution === undefined
    ? (mode === 'image' ? '720P' : '480P') : input.resolution;
  if (!(mode === 'image' ? VIDEO_I2V_RESOLUTIONS : VIDEO_RESOLUTIONS).includes(resolution))
    throw new BodyError(422, mode === 'image'
      ? 'Image-to-video generates at 720P or 1080P.'
      : 'Choose a supported video resolution.');
  const ratio = input.ratio === undefined ? 'adaptive' : input.ratio;
  if (!VIDEO_RATIOS.includes(ratio))
    throw new BodyError(422, 'Choose a supported video format.');
  const duration = input.duration === undefined ? 5 : input.duration;
  if (!Number.isInteger(duration) || duration < 3 || duration > 10)
    throw new BodyError(422, 'Choose a video length between 3 and 10 seconds.');
  if (typeof input.request_id !== 'string' || !UUID.test(input.request_id))
    throw new BodyError(422, 'A valid generation request reference is required.');
  return {
    prompt, resolution, ratio, duration, requestId: input.request_id.toLowerCase(),
    mode, imageUrl, rightsConfirmed: input.rights_confirmed === true,
  };
}

// Honest per-state allowance denials (D7): expected account states are not
// "could not be verified"; that copy is reserved for a genuine check failure.
export function allowanceDenial(receipt) {
  return {
    trial_limit: [429, 'Your 15 trial AI creations are used. View subscription plans for more AI, or create and upload videos manually for free.'],
    membership_required: [403, 'AI video generation needs a trial or a subscription with AI included. View subscription plans for more AI, or create and upload videos manually for free.'],
    monthly_limit: [429, "You have reached this month's AI creation limit for your plan."],
  }[receipt?.code] || [503, 'Your AI generation allowance could not be verified.'];
}

function publicJob(job) {
  if (!job) return null;
  return {
    request_id: job.request_id, state: job.state, provider: job.provider,
    model: job.model, mode: job.mode ?? 'text', resolution: job.resolution, ratio: job.ratio,
    duration_seconds: job.duration_seconds, media_id: job.media_id ?? null,
    error: job.error ?? null, created_at: job.created_at, updated_at: job.updated_at,
  };
}

async function readJob(env, fetcher, actor, requestId) {
  const rows = await supabase(env, fetcher,
    JOBS + '?select=' + JOB_SELECT + '&owner_id=eq.' + actor.id +
    '&request_id=eq.' + requestId + '&limit=1', { admin: true });
  if (!Array.isArray(rows) || rows.length > 1) fail(503, 'Video generation job could not be verified.');
  return rows.length === 1 ? rows[0] : null;
}

async function patchJob(env, fetcher, actor, requestId, fields, filter = '') {
  const rows = await supabase(env, fetcher,
    JOBS + '?owner_id=eq.' + actor.id + '&request_id=eq.' + requestId + filter +
    '&select=' + JOB_SELECT,
    { method: 'PATCH', admin: true, prefer: 'return=representation',
      body: { ...fields, updated_at: new Date().toISOString() } });
  if (!Array.isArray(rows) || rows.length > 1) fail(503, 'Video generation job update could not be verified.');
  return rows.length === 1 ? rows[0] : null;
}

async function submitJob(request, env, fetcher) {
  if (!videoAIReady(env))
    return response(503, { error: 'AI video generation is not currently available.' });
  const input = validateVideoRequest(await readJsonBody(request, 6000));
  const actor = await member(request, env, fetcher);
  const aiConsent = await verifyOwnerAIConsent(env, { uid: actor.id, jwt: actor.jwt }, fetcher);
  if (!aiConsent.allowed) return response(aiConsent.status, {
    error: aiConsent.status === 403
      ? 'Turn on AI Assistance in My Account to use AI video generation.'
      : 'AI permission could not be verified.' });

  let receipt;
  try {
    receipt = await reserveTrialContent(env, actor.jwt, 'video', input.requestId, fetcher);
  } catch {
    // A genuine allowance-check failure (the reserve RPC itself failed) is
    // the only state that may say "could not be verified" (PR #402 / D7).
    return response(503, { error: 'Your AI generation allowance could not be verified.' });
  }
  if (!receipt.allowed) {
    const [status, error] = allowanceDenial(receipt);
    return response(status, { error });
  }

  const existing = await readJob(env, fetcher, actor, input.requestId);
  if (existing) return response(200, { job: publicJob(existing) });
  const now = new Date().toISOString();
  const inserted = await supabase(env, fetcher, JOBS + '?select=' + JOB_SELECT, {
    method: 'POST', admin: true, prefer: 'return=representation',
    body: {
      owner_id: actor.id, request_id: input.requestId, provider: videoProviderId(env),
      model: providerModel(env, videoProviderId(env), input.mode),
      state: 'submitted', prompt: input.prompt,
      resolution: input.resolution, ratio: input.ratio,
      duration_seconds: input.duration, mode: input.mode,
      image_url: input.imageUrl, rights_confirmed: input.rightsConfirmed,
      allowance_tracked: receipt.tracked === true,
      created_at: now, updated_at: now,
    },
  });
  if (!Array.isArray(inserted) || inserted.length !== 1)
    fail(503, 'Video generation job could not be recorded.');
  return response(202, { job: publicJob(inserted[0]) });
}

async function claimJob(env, fetcher, actor, job) {
  if (job.state === 'submitted')
    return patchJob(env, fetcher, actor, job.request_id, { state: 'running' }, '&state=eq.submitted');
  if (job.state === 'running' &&
      Date.now() - new Date(job.updated_at).getTime() > RUNNING_STALE_MS)
    // A previous Advance stopped mid-run (closed tab, network loss). The
    // updated_at equality filter makes the re-claim single-winner.
    return patchJob(env, fetcher, actor, job.request_id, { state: 'running' },
      '&state=eq.running&updated_at=eq.' + encodeURIComponent(job.updated_at));
  return null;
}

async function downloadProviderVideo(fetcher, videoUrl) {
  let result;
  try {
    result = await fetcher(videoUrl, { signal: AbortSignal.timeout(120000) });
  } catch {
    fail(503, 'Your video was generated but could not be downloaded for saving. Retry to finish saving it — the generation will not be repeated.');
  }
  if (!result.ok)
    fail(503, 'Your video was generated but could not be downloaded for saving. Retry to finish saving it — the generation will not be repeated.');
  const declared = Number(result.headers?.get?.('content-length') || 0);
  if (declared > MAX_VIDEO_BYTES)
    fail(503, 'The generated video is larger than the 40 MB private library limit, so it cannot be saved.');
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length < MIN_VIDEO_BYTES || bytes.length > MAX_VIDEO_BYTES)
    fail(503, 'The generated video could not be verified for saving. Retry to finish saving it — the generation will not be repeated.');
  const headerType = String(result.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  const type = headerType === 'video/webm' ? 'video/webm' : 'video/mp4';
  if (!memberMediaSignature(bytes, type))
    fail(503, 'The generated file is not a valid ' + (type === 'video/webm' ? 'WebM' : 'MP4') + ' video, so it was not saved.');
  return { bytes, type };
}

async function storeFinishedVideo(env, fetcher, actor, job) {
  const { bytes, type } = await downloadProviderVideo(fetcher, job.provider_video_url);
  const bucket = env.IFUND_CAMPAIGN_MEDIA;
  const stored = await storeMemberMediaBytes(env, fetcher, bucket, actor, {
    bytes, type, name: 'AI-generated video.' + (type === 'video/webm' ? 'webm' : 'mp4'),
  });
  let finalizeNote = null;
  try {
    const done = await completeTrialContent(env, actor.jwt, {
      tracked: job.allowance_tracked === true, requestId: job.request_id, kind: 'video',
    }, fetcher);
    if (done !== true) finalizeNote = 'The video is saved, but its allowance receipt could not be finalized.';
  } catch {
    finalizeNote = 'The video is saved, but its allowance receipt could not be finalized.';
  }
  const completed = await patchJob(env, fetcher, actor, job.request_id, {
    state: 'completed', media_id: stored.id, error: finalizeNote,
  });
  return completed ?? { ...job, state: 'completed', media_id: stored.id, error: finalizeNote };
}

async function advanceJob(request, env, fetcher, requestId) {
  if (!videoAIReady(env))
    return response(503, { error: 'AI video generation is not currently available.' });
  const actor = await member(request, env, fetcher);
  let job = await readJob(env, fetcher, actor, requestId);
  if (!job) return response(404, { error: 'Video generation job not found.' });
  if (job.state === 'completed' || job.state === 'failed')
    return response(200, { job: publicJob(job) });

  if (job.state === 'submitted' || job.state === 'running') {
    const claimed = await claimJob(env, fetcher, actor, job);
    if (!claimed) {
      const current = await readJob(env, fetcher, actor, requestId);
      return response(200, { job: publicJob(current ?? job) });
    }
    job = claimed;
    const provider = createVideoProvider(env, fetcher, job.provider);
    if (!provider) fail(503, 'AI video generation is not currently available.');
    let outcome;
    try {
      outcome = await provider.submit({
        prompt: PROMPT_PREFIX + job.prompt, resolution: job.resolution,
        ratio: job.ratio, duration: job.duration_seconds,
        image: job.mode === 'image' ? job.image_url : undefined,
      });
    } catch (error) {
      if (error instanceof VideoProviderError) {
        const failed = await patchJob(env, fetcher, actor, requestId,
          { state: 'failed', error: error.message });
        return response(200, { job: publicJob(failed ?? { ...job, state: 'failed', error: error.message }) });
      }
      throw error;
    }
    if (outcome.status === 'pending') {
      const pending = await patchJob(env, fetcher, actor, requestId,
        { state: 'provider_pending', provider_job_id: outcome.providerJobId, error: null });
      return response(200, { job: publicJob(pending ?? { ...job, state: 'provider_pending' }) });
    }
    // Record the finished generation BEFORE storage so a storage failure
    // can never silently discard it (D8).
    job = await patchJob(env, fetcher, actor, requestId, {
      state: 'provider_completed', provider_video_url: outcome.videoUrl, error: null,
    }) ?? { ...job, state: 'provider_completed', provider_video_url: outcome.videoUrl };
  }

  if (job.state === 'provider_pending') {
    const provider = createVideoProvider(env, fetcher, job.provider);
    if (!provider) fail(503, 'AI video generation is not currently available.');
    let outcome;
    try {
      outcome = await provider.poll(job.provider_job_id);
    } catch (error) {
      if (error instanceof VideoProviderError) fail(503, error.message);
      throw error;
    }
    if (outcome.status === 'pending') return response(200, { job: publicJob(job) });
    if (outcome.status === 'failed') {
      const failure = outcome.error || 'The video provider could not finish this generation.';
      const failed = await patchJob(env, fetcher, actor, requestId,
        { state: 'failed', error: failure });
      return response(200, { job: publicJob(failed ?? { ...job, state: 'failed', error: failure }) });
    }
    job = await patchJob(env, fetcher, actor, requestId, {
      state: 'provider_completed', provider_video_url: outcome.videoUrl, error: null,
    }) ?? { ...job, state: 'provider_completed', provider_video_url: outcome.videoUrl };
  }

  if (job.state === 'provider_completed') {
    try {
      const completed = await storeFinishedVideo(env, fetcher, actor, job);
      return response(200, { job: publicJob(completed) });
    } catch (error) {
      // Storage/download failure: the finished generation stays recorded on
      // the job in provider_completed; a later Advance retries ONLY the
      // save. Surface the reason on the job, not as a lost generation.
      const message = error instanceof Error ? String(error.message).slice(0, 240)
        : 'Your video was generated but could not be saved. Retry to finish saving it.';
      const noted = await patchJob(env, fetcher, actor, requestId, { error: message });
      return response(200, { job: publicJob(noted ?? { ...job, error: message }) });
    }
  }
  return response(200, { job: publicJob(job) });
}

export async function routeVideoGeneration(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/ai/videos/status') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      return response(200, {
        videoGeneration: videoAIReady(env) ? 'enabled' : 'not_configured',
        provider: videoProviderId(env),
        model: providerModel(env, videoProviderId(env), 'text'),
        imageModel: providerModel(env, videoProviderId(env), 'image'),
      });
    }
    if (path === '/api/ai/videos/generate') {
      if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
      return await submitJob(request, env, fetcher);
    }
    const jobMatch = /^\/api\/ai\/videos\/jobs\/([0-9a-f-]{36})(\/advance)?$/i.exec(path);
    if (jobMatch && UUID.test(jobMatch[1])) {
      const requestId = jobMatch[1].toLowerCase();
      if (jobMatch[2]) {
        if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
        return await advanceJob(request, env, fetcher, requestId);
      }
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      if (!videoAIReady(env))
        return response(503, { error: 'AI video generation is not currently available.' });
      const actor = await member(request, env, fetcher);
      const job = await readJob(env, fetcher, actor, requestId);
      if (!job) return response(404, { error: 'Video generation job not found.' });
      return response(200, { job: publicJob(job) });
    }
    return response(404, { error: 'Not found.' });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 503
      ? error.status : 503;
    return response(status, {
      error: status === 503 && !error?.status
        ? 'Video generation service is temporarily unavailable.'
        : String(error.message).slice(0, 240),
    });
  }
}
