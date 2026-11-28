// AI video generation for the Media Studio. The repo names no external
// video provider and no second credential vault exists; the platform's AI
// provider everywhere else is Cloudflare Workers AI, whose catalog carries
// the Alibaba Wan text-to-video model — so Wan is the wired model family,
// behind a provider-swappable adapter (see createVideoProvider):
//   - 'cloudflare-workers-ai' (default): Wan via the existing AI binding.
//   - 'alibaba-model-studio': Wan direct via the DashScope async API,
//     whose new-account free quotas are the only real free API seconds
//     for video (one-time, ~90 days — provider research 2026-11-28).
//   - 'executive-concierge': no synchronous adapter at all. The Worker
//     builds a generation brief from the member's own campaign context,
//     leaves the durable job in the pickup-ready state
//     'awaiting_concierge', and an external agent (Executive Agent Muse)
//     picks the job up through secret-authenticated endpoints, generates
//     the video off-platform, and returns the finished bytes, which land
//     through the same verified storage path as a provider result.
//     Selected with IFUND_VIDEO_PROVIDER=executive-concierge (owner
//     decision 2026-11-28). No provider credits are spent, so the pilot
//     quota guard never applies to concierge jobs; the shared allowance
//     reserve/complete still does, unchanged.
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
// Concierge-only routes (shared-secret header, never member JWTs):
//   GET  /api/ai/videos/concierge/pending            queued briefs
//   POST /api/ai/videos/concierge/jobs/:id/complete  return finished bytes
//   POST /api/ai/videos/concierge/jobs/:id/fail      report a failed job
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
import { reserveTrialContent, completeTrialContent, completeTrialContentForOwner } from './trialAiContent.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { UUID, fail, supabase, member } from './media/privateDocuments.js';
import { storeMemberMediaBytes, memberMediaSignature } from './media/memberMedia.js';
import { findPublicFacingViolations, stripPublicFacingViolations } from '../apps/web/src/lib/campaignCopyQuality.mjs';

export const VIDEO_MODEL = 'alibaba/wan-3.0';
export const VIDEO_I2V_MODEL = 'alibaba/wan-2.7-i2v';
export const VIDEO_PROVIDER_ID = 'cloudflare-workers-ai';
export const MODEL_STUDIO_PROVIDER_ID = 'alibaba-model-studio';
export const CONCIERGE_PROVIDER_ID = 'executive-concierge';
export const CONCIERGE_MODEL = 'executive-concierge';
export const MODEL_STUDIO_T2V_MODEL = 'wan2.7-t2v';
export const MODEL_STUDIO_I2V_MODEL = 'wan2.5-i2v-preview';
export const MODEL_STUDIO_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com';
export const VIDEO_RESOLUTIONS = Object.freeze(['480P', '720P', '1080P']);
export const VIDEO_I2V_RESOLUTIONS = Object.freeze(['720P', '1080P']);
export const VIDEO_RATIOS = Object.freeze(['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4']);
const CANONICAL_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';
const JOBS = '/rest/v1/ifund_video_generations';
const JOB_SELECT = 'owner_id,request_id,provider,model,state,prompt,resolution,ratio,duration_seconds,mode,image_url,rights_confirmed,provider_job_id,provider_video_url,media_id,allowance_tracked,error,created_at,updated_at';
// Concierge reads additionally carry the campaign reference and the
// brief. The member routes keep the original select on purpose: the
// brief is generator-facing material and is never exposed through the
// member job API.
const CONCIERGE_JOB_SELECT = JOB_SELECT + ',campaign_id,brief';
const CAMPAIGNS = '/rest/v1/ifund_campaigns';
const CAMPAIGN_SELECT = 'id,owner_id,title,summary,story,category,goal_amount,cover_image_url,status';
const MAX_BRIEF_CHARS = 4000; // matches the brief column check (migration 20261128010000)
const CONCIERGE_PENDING_LIMIT = 20;
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
// Wan family — directly against Alibaba Model Studio (DashScope), or via
// the Workers AI binding. Owner decision (2026-11-28): pilot on the free
// quotas, decide the paid floor later — so Model Studio is the DEFAULT
// adapter, the Workers AI route (metered from the first second) is only
// ever an explicit selection, and no code path falls back between
// providers or spills into paid generation (see the pilot guard below).
export function videoProviderId(env) {
  if (env?.IFUND_VIDEO_PROVIDER === CONCIERGE_PROVIDER_ID) return CONCIERGE_PROVIDER_ID;
  return env?.IFUND_VIDEO_PROVIDER === VIDEO_PROVIDER_ID
    ? VIDEO_PROVIDER_ID : MODEL_STUDIO_PROVIDER_ID;
}

// Known one-time free quotas on Alibaba Model Studio, in seconds per
// model (provider research, 2026-11-28; ~90-day expiry from account
// activation). During the pilot the Model Studio adapter may only run
// models with a free bucket: a model outside this map is a paid model,
// and selecting one fails closed (not_configured) unless the owner later
// enables paid models explicitly with IFUND_VIDEO_ALLOW_PAID_MODELS.
export const FREE_QUOTA_SECONDS = Object.freeze({
  'wanx2.1-t2v-turbo': 200,
  'wanx2.1-t2v-plus': 200,
  'wan2.5-t2v-preview': 50,
  'wan2.5-i2v-preview': 50,
  'wan2.6-t2v': 50,
  'wan2.7-t2v': 50,
  'wan3.0-video': 30,
  'wan3.0-video-prime': 30,
});

export const PILOT_CAPACITY_MESSAGE =
  'AI video generation has reached the free pilot capacity for now. ' +
  'The pilot runs on a limited free quota, and generation pauses when it ' +
  'is used up rather than switching to paid generation. You can still ' +
  'upload videos you already have for free.';

export class PilotCapacityError extends VideoProviderError {}

export function pilotExpiresAt(env) {
  const started = typeof env?.IFUND_VIDEO_PILOT_STARTED_AT === 'string'
    ? Date.parse(env.IFUND_VIDEO_PILOT_STARTED_AT) : NaN;
  if (!Number.isFinite(started)) return null;
  return new Date(started + 90 * 24 * 60 * 60 * 1000).toISOString();
}

export function providerModel(env, providerId, mode) {
  // The concierge has no provider model: generation happens off-platform
  // and the job records the concierge label as its model.
  if (providerId === CONCIERGE_PROVIDER_ID) return CONCIERGE_MODEL;
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

function conciergeSecret(env) {
  return typeof env?.CONCIERGE_PICKUP_SECRET === 'string'
    ? env.CONCIERGE_PICKUP_SECRET.trim() : '';
}

// The readiness every provider shares: the feature flag, the canonical
// project, both Supabase keys and the private media pipeline. The
// concierge storage path gates on this directly, because completing a
// queued job must stay possible for a job whose provider was selected
// when it was created.
function videoCommonReady(env) {
  return env?.IFUND_VIDEO_AI_ENABLED === 'enabled' &&
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
}

export function videoAIReady(env) {
  if (!videoCommonReady(env)) return false;
  // The concierge's credential is the pickup secret: without it nobody
  // could ever collect a queued job, so the feature reports itself
  // unconfigured rather than accepting jobs that can never be served.
  if (videoProviderId(env) === CONCIERGE_PROVIDER_ID)
    return conciergeSecret(env).length >= 16;
  // Provider-specific credential: the Model Studio API key, or the
  // Workers AI binding. Without the selected provider's credential the
  // feature reports itself unconfigured rather than faking success.
  if (videoProviderId(env) === MODEL_STUDIO_PROVIDER_ID) {
    if (modelStudioKey(env).length < 10) return false;
    // HARD RULE — no paid spillover: during the pilot, both active
    // models must carry a known free quota. A paid-only model selection
    // fails closed here instead of ever reaching metered generation,
    // unless the owner explicitly enables paid models later.
    if (env?.IFUND_VIDEO_ALLOW_PAID_MODELS !== 'enabled') {
      for (const mode of ['text', 'image'])
        if (!(providerModel(env, MODEL_STUDIO_PROVIDER_ID, mode) in FREE_QUOTA_SECONDS))
          return false;
    }
    return true;
  }
  return typeof env?.AI?.run === 'function';
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
  // The concierge provider has no synchronous adapter: its jobs wait in
  // awaiting_concierge for the external agent and return through the
  // pickup/completion endpoints. Advance never calls an adapter for
  // them; returning null keeps any unexpected Advance an honest
  // not-available instead of a wrong provider call.
  if (providerId === CONCIERGE_PROVIDER_ID) return null;
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
        let res, data;
        try {
          res = await fetcher(base + '/api/v1/services/aigc/video-generation/video-synthesis', {
            method: 'POST',
            headers: { ...headers, 'X-DashScope-Async': 'enable' },
            body: JSON.stringify(body),
          });
          data = await res.json().catch(() => null);
        } catch {
          throw new VideoProviderError('The video provider could not be reached. No finished video was produced, so this attempt does not count as a completed creation.');
        }
        if (!res.ok) {
          // A quota refusal is the pilot ending, not a generic outage:
          // surface it as the pilot-capacity state (and never retry into
          // a paid path — there is none in this adapter).
          if (isQuotaSignal(data)) throw new PilotCapacityError(PILOT_CAPACITY_MESSAGE);
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

function isQuotaSignal(data) {
  const text = String(data?.code || '') + ' ' + String(data?.message || '') +
    ' ' + String(data?.output?.code || '') + ' ' + String(data?.output?.message || '');
  return /quota|exhaust/i.test(text);
}

export function normalizeModelStudioTask(data) {
  const output = data?.output;
  const status = typeof output?.task_status === 'string' ? output.task_status : '';
  if (status === 'SUCCEEDED' &&
      typeof output?.video_url === 'string' && /^https:\/\/[^\s]+$/i.test(output.video_url))
    return { status: 'completed', videoUrl: output.video_url };
  if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN')
    return {
      status: 'failed',
      error: isQuotaSignal(data) ? PILOT_CAPACITY_MESSAGE
        : 'The video provider could not finish this generation. This attempt does not count as a completed creation.',
    };
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
      Object.keys(input).some(key => !['prompt', 'resolution', 'ratio', 'duration', 'request_id', 'image_url', 'rights_confirmed', 'campaign_id'].includes(key)))
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
  // Optional campaign the video is for. Ownership is verified against
  // the member's own campaigns before any brief is built from it.
  let campaignId = null;
  if (input.campaign_id !== undefined && input.campaign_id !== null && input.campaign_id !== '') {
    if (typeof input.campaign_id !== 'string' || !UUID.test(input.campaign_id))
      throw new BodyError(422, 'Choose one of your campaigns for this video, or leave the campaign out.');
    campaignId = input.campaign_id.toLowerCase();
  }
  return {
    prompt, resolution, ratio, duration, requestId: input.request_id.toLowerCase(),
    mode, imageUrl, rightsConfirmed: input.rights_confirmed === true, campaignId,
  };
}

// The campaign a brief is built from is read with the service role but
// filtered to the requesting member: a campaign id that is not theirs
// (or does not exist) is a client error, never another member's context.
async function readOwnCampaign(env, fetcher, actor, campaignId) {
  const rows = await supabase(env, fetcher,
    CAMPAIGNS + '?select=' + CAMPAIGN_SELECT + '&id=eq.' + campaignId +
    '&owner_id=eq.' + actor.id + '&limit=1', { admin: true });
  if (!Array.isArray(rows) || rows.length !== 1)
    fail(422, 'Choose one of your own campaigns for this video.');
  return rows[0];
}

/**
 * The concierge generation brief: assembled server-side from the
 * campaign's own context (title, summary, story, category, goal, cover
 * image) plus the member's direction, with the output constraints the
 * Studio asked for. Before it is stored on the job it passes through
 * the PR #404 public-facing discretion scan with the raw campaign text
 * and the member's direction as the source: pleading, raw-need echoes
 * and internal objectives are stripped sentence by sentence, so nothing
 * private or pleading reaches the generator. The cleaned brief is
 * re-scanned; any residual violation fails closed instead of shipping.
 */
export function buildConciergeBrief({ campaign = null, prompt, mode = 'text',
  imageUrl = null, resolution, ratio, duration }) {
  const source = [campaign?.title, campaign?.summary, campaign?.story, prompt]
    .filter(Boolean).join('\n');
  const lines = [
    'Original short promotional video for a personal fundraiser campaign on Interplanetary Fund.',
    'Hard rules: no text, letters, logos or watermarks anywhere in the video; ' +
      'do not depict real people, claimed donations, or fundraising totals; illustrative scenes only.',
    'Format: ' + duration + ' seconds, ' +
      (ratio === 'adaptive' ? 'adaptive aspect' : ratio + ' aspect') + ', ' + resolution + '.',
  ];
  if (campaign) {
    lines.push('Campaign: ' + campaign.title);
    if (campaign.category)
      lines.push('Category: ' + String(campaign.category).replace(/_/g, ' '));
    if (campaign.summary)
      lines.push('What this campaign is about: ' + campaign.summary);
    if (campaign.story)
      lines.push("Campaign story, in the organizer's own words, for subject and setting:\n" +
        String(campaign.story).slice(0, 1400));
    if (campaign.goal_amount)
      lines.push('Funding goal, recorded as context for scale only — never plead amounts in the video: $' +
        Number(campaign.goal_amount).toLocaleString('en-US'));
    if (campaign.cover_image_url)
      lines.push('Campaign cover image, as a subject and setting reference: ' + campaign.cover_image_url);
  }
  if (mode === 'image' && imageUrl)
    lines.push('Starting image supplied by the organizer, with rights confirmed: ' + imageUrl);
  lines.push("Organizer's direction for this video: " + prompt);
  const cleaned = stripPublicFacingViolations(lines.join('\n\n'), source);
  if (!cleaned || findPublicFacingViolations(cleaned, source).length > 0)
    fail(503, 'A video brief could not be prepared from this campaign wording. ' +
      'Remove direct appeals from the campaign text and the video description, then try again.');
  return cleaned.slice(0, MAX_BRIEF_CHARS);
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
    campaign_id: job.campaign_id ?? null,
    error: job.error ?? null, created_at: job.created_at, updated_at: job.updated_at,
  };
}

// Pilot burn, account-wide: the free quota belongs to the platform's
// Model Studio account, not to a member, so usage sums every finished
// generation recorded for the provider + model. Failed generations do
// not consume quota at the provider, so only finished states count.
export async function pilotUsedSeconds(env, fetcher, model) {
  const rows = await supabase(env, fetcher,
    JOBS + '?select=duration_seconds&provider=eq.' + MODEL_STUDIO_PROVIDER_ID +
    '&model=eq.' + encodeURIComponent(model) + '&state=in.(completed,provider_completed)',
    { admin: true });
  if (!Array.isArray(rows)) fail(503, 'Video generation usage could not be verified.');
  return rows.reduce((sum, row) => sum + (Number(row.duration_seconds) || 0), 0);
}

async function readJob(env, fetcher, actor, requestId) {  const rows = await supabase(env, fetcher,
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

  // Pilot capacity gate (checked before any allowance is reserved): on
  // the Model Studio pilot, a request that would pass the model's known
  // free quota fails closed with the pilot-capacity state. There is no
  // paid fallback behind this gate.
  const providerId = videoProviderId(env);
  if (providerId === MODEL_STUDIO_PROVIDER_ID && env.IFUND_VIDEO_ALLOW_PAID_MODELS !== 'enabled') {
    const model = providerModel(env, providerId, input.mode);
    const quota = FREE_QUOTA_SECONDS[model];
    if (quota !== undefined) {
      const used = await pilotUsedSeconds(env, fetcher, model);
      if (used + input.duration > quota)
        return response(429, { error: PILOT_CAPACITY_MESSAGE, code: 'pilot_capacity' });
    }
  }

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

  // A campaign reference is verified against the member's own campaigns
  // before anything is built from it. For the concierge provider the
  // brief is assembled now, server-side, from that campaign's context —
  // the job then waits for pickup instead of calling an external API,
  // and no pilot quota or paid-model gate applies (no provider credits
  // exist to spend); the allowance reservation above is the only gate.
  const campaign = input.campaignId
    ? await readOwnCampaign(env, fetcher, actor, input.campaignId) : null;
  const brief = providerId === CONCIERGE_PROVIDER_ID
    ? buildConciergeBrief({
        campaign, prompt: input.prompt, mode: input.mode, imageUrl: input.imageUrl,
        resolution: input.resolution, ratio: input.ratio, duration: input.duration,
      })
    : null;

  const now = new Date().toISOString();
  const body = {
    owner_id: actor.id, request_id: input.requestId, provider: providerId,
    model: providerModel(env, providerId, input.mode),
    state: 'submitted', prompt: input.prompt,
    resolution: input.resolution, ratio: input.ratio,
    duration_seconds: input.duration, mode: input.mode,
    image_url: input.imageUrl, rights_confirmed: input.rightsConfirmed,
    allowance_tracked: receipt.tracked === true,
    created_at: now, updated_at: now,
  };
  let select = JOB_SELECT;
  if (input.campaignId) { body.campaign_id = input.campaignId; select = CONCIERGE_JOB_SELECT; }
  if (brief !== null) {
    body.state = 'awaiting_concierge';
    body.brief = brief;
    select = CONCIERGE_JOB_SELECT;
  }
  const inserted = await supabase(env, fetcher, JOBS + '?select=' + select, {
    method: 'POST', admin: true, prefer: 'return=representation', body,
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

// The one byte-verification every finished video passes before storage,
// wherever the bytes came from (a provider download or a concierge
// return): bounded size and a real MP4/WebM signature for the declared
// type. Anything else is never stored and never completes an allowance.
function verifyVideoBytes(bytes, headerType) {
  if (bytes.length < MIN_VIDEO_BYTES || bytes.length > MAX_VIDEO_BYTES)
    fail(503, 'The generated video could not be verified for saving. Retry to finish saving it — the generation will not be repeated.');
  const type = headerType === 'video/webm' ? 'video/webm' : 'video/mp4';
  if (!memberMediaSignature(bytes, type))
    fail(503, 'The generated file is not a valid ' + (type === 'video/webm' ? 'WebM' : 'MP4') + ' video, so it was not saved.');
  return type;
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
  const headerType = String(result.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  const type = verifyVideoBytes(bytes, headerType);
  return { bytes, type };
}

// Store already-verified bytes through the Phase 1 pipeline, complete
// the allowance (only ever after the verified store), and mark the job
// completed. completeAllowance is the caller's own completion call —
// the member-JWT completion on the provider path, the trusted
// service-role completion on the concierge return path — so both paths
// share identical storage and ordering semantics.
async function storeVerifiedVideo(env, fetcher, actor, job, bytes, type,
  completeAllowance, patchFilter = '') {
  const bucket = env.IFUND_CAMPAIGN_MEDIA;
  const stored = await storeMemberMediaBytes(env, fetcher, bucket, actor, {
    bytes, type, name: 'AI-generated video.' + (type === 'video/webm' ? 'webm' : 'mp4'),
  });
  let finalizeNote = null;
  try {
    const done = await completeAllowance();
    if (done !== true) finalizeNote = 'The video is saved, but its allowance receipt could not be finalized.';
  } catch {
    finalizeNote = 'The video is saved, but its allowance receipt could not be finalized.';
  }
  const completed = await patchJob(env, fetcher, actor, job.request_id, {
    state: 'completed', media_id: stored.id, error: finalizeNote,
  }, patchFilter);
  return completed ?? { ...job, state: 'completed', media_id: stored.id, error: finalizeNote };
}

async function storeFinishedVideo(env, fetcher, actor, job) {
  const { bytes, type } = await downloadProviderVideo(fetcher, job.provider_video_url);
  return storeVerifiedVideo(env, fetcher, actor, job, bytes, type,
    () => completeTrialContent(env, actor.jwt, {
      tracked: job.allowance_tracked === true, requestId: job.request_id, kind: 'video',
    }, fetcher));
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

// --- Concierge pickup API -------------------------------------------------
// Authenticated by the CONCIERGE_PICKUP_SECRET Worker secret in the
// x-concierge-secret header — never by a member JWT, because the caller
// is the external concierge agent, not the member. An unset secret fails
// closed (503); a missing or wrong one is a 401. The secret is compared
// in constant time over its full length.

function conciergeAuth(request, env) {
  const secret = conciergeSecret(env);
  if (secret.length < 16) return 'unconfigured';
  const presented = request.headers.get('x-concierge-secret') || '';
  if (presented.length !== secret.length) return 'denied';
  let diff = 0;
  for (let i = 0; i < secret.length; i++)
    diff |= presented.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0 ? 'ok' : 'denied';
}

function conciergeGate(request, env) {
  const auth = conciergeAuth(request, env);
  if (auth === 'unconfigured')
    return response(503, { error: 'Concierge pickup is not configured.' });
  if (auth !== 'ok')
    return response(401, { error: 'Concierge pickup is not authorized.' });
  return null;
}

async function readConciergeJob(env, fetcher, requestId) {
  const rows = await supabase(env, fetcher,
    JOBS + '?select=' + CONCIERGE_JOB_SELECT + '&request_id=eq.' + requestId +
    '&limit=1', { admin: true });
  if (!Array.isArray(rows) || rows.length > 1)
    fail(503, 'Video generation job could not be verified.');
  return rows.length === 1 ? rows[0] : null;
}

async function patchConciergeJob(env, fetcher, job, fields, filter = '') {
  const rows = await supabase(env, fetcher,
    JOBS + '?owner_id=eq.' + job.owner_id + '&request_id=eq.' + job.request_id +
    filter + '&select=' + CONCIERGE_JOB_SELECT,
    { method: 'PATCH', admin: true, prefer: 'return=representation',
      body: { ...fields, updated_at: new Date().toISOString() } });
  if (!Array.isArray(rows) || rows.length > 1)
    fail(503, 'Video generation job update could not be verified.');
  return rows.length === 1 ? rows[0] : null;
}

function conciergeJobView(job) {
  return {
    request_id: job.request_id, state: job.state,
    campaign_id: job.campaign_id ?? null, media_id: job.media_id ?? null,
    error: job.error ?? null, created_at: job.created_at, updated_at: job.updated_at,
  };
}

function conciergePendingView(job) {
  return {
    request_id: job.request_id, campaign_id: job.campaign_id ?? null,
    brief: job.brief ?? null, prompt: job.prompt, mode: job.mode ?? 'text',
    image_url: job.image_url ?? null, resolution: job.resolution,
    ratio: job.ratio, duration_seconds: job.duration_seconds,
    created_at: job.created_at,
  };
}

async function conciergePending(request, env, fetcher) {
  const gate = conciergeGate(request, env);
  if (gate) return gate;
  const rows = await supabase(env, fetcher,
    JOBS + '?select=' + CONCIERGE_JOB_SELECT +
    '&provider=eq.' + CONCIERGE_PROVIDER_ID + '&state=eq.awaiting_concierge' +
    '&order=created_at.asc&limit=' + CONCIERGE_PENDING_LIMIT, { admin: true });
  if (!Array.isArray(rows)) fail(503, 'Concierge queue could not be verified.');
  return response(200, { jobs: rows.map(conciergePendingView) });
}

async function readConciergeVideoBody(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_VIDEO_BYTES)
    fail(413, 'The generated video is larger than the 40 MB private library limit, so it cannot be saved.');
  let bytes;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    fail(400, 'The generated video bytes could not be read.');
  }
  if (!bytes.length) fail(400, 'The generated video bytes could not be read.');
  const headerType = String(request.headers.get('content-type') || '')
    .split(';')[0].trim().toLowerCase();
  return { bytes, type: verifyVideoBytes(bytes, headerType) };
}

async function conciergeComplete(request, env, fetcher, requestId) {
  const gate = conciergeGate(request, env);
  if (gate) return gate;
  if (!videoCommonReady(env))
    return response(503, { error: 'AI video generation is not currently available.' });
  const job = await readConciergeJob(env, fetcher, requestId);
  if (!job || job.provider !== CONCIERGE_PROVIDER_ID)
    return response(404, { error: 'Concierge job not found.' });
  // Idempotent return: a repeated completion for a finished job reports
  // the recorded result — nothing is stored or completed a second time.
  if (job.state === 'completed')
    return response(200, { job: conciergeJobView(job) });
  if (job.state !== 'awaiting_concierge')
    return response(409, {
      error: 'This concierge job is ' + job.state + ' and cannot accept a returned video.',
      job: conciergeJobView(job),
    });
  const { bytes, type } = await readConciergeVideoBody(request);
  const actor = { id: job.owner_id };
  let completed;
  try {
    completed = await storeVerifiedVideo(env, fetcher, actor, job, bytes, type,
      () => completeTrialContentForOwner(env, job.owner_id, {
        tracked: job.allowance_tracked === true, requestId: job.request_id, kind: 'video',
      }, fetcher),
      '&state=eq.awaiting_concierge');
  } catch (error) {
    // Storage failed: the job stays pickup-ready so the agent can return
    // the video again; the reason is recorded on the job, and no
    // allowance was completed.
    const message = error instanceof Error ? String(error.message).slice(0, 240)
      : 'Your video was generated but could not be saved.';
    await patchConciergeJob(env, fetcher, job, { error: message }).catch(() => null);
    throw error;
  }
  if (!completed) {
    // The completion transition is state-guarded; if it matched no row
    // the job changed under us — report the recorded state, not a guess.
    const current = await readConciergeJob(env, fetcher, requestId);
    return response(200, { job: conciergeJobView(current ?? job) });
  }
  return response(200, { job: conciergeJobView({ ...job, ...completed }) });
}

async function conciergeFail(request, env, fetcher, requestId) {
  const gate = conciergeGate(request, env);
  if (gate) return gate;
  const job = await readConciergeJob(env, fetcher, requestId);
  if (!job || job.provider !== CONCIERGE_PROVIDER_ID)
    return response(404, { error: 'Concierge job not found.' });
  if (job.state === 'completed' || job.state === 'failed')
    return response(200, { job: conciergeJobView(job) });
  if (job.state !== 'awaiting_concierge')
    return response(409, {
      error: 'This concierge job is ' + job.state + ' and cannot be failed.',
      job: conciergeJobView(job),
    });
  const body = await readJsonBody(request, 2000);
  const reason = typeof body?.reason === 'string'
    ? body.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 240) : '';
  const error = reason ||
    'The concierge could not finish this generation. This attempt does not count as a completed creation.';
  // Existing failure semantics: the allowance is never completed for a
  // failed generation; the reservation lapses under the usual rules.
  const failed = await patchConciergeJob(env, fetcher, job,
    { state: 'failed', error }, '&state=eq.awaiting_concierge');
  return response(200, {
    job: conciergeJobView(failed ?? { ...job, state: 'failed', error }),
  });
}

export async function routeVideoGeneration(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/ai/videos/status') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      const providerId = videoProviderId(env);
      const body = {
        videoGeneration: videoAIReady(env) ? 'enabled' : 'not_configured',
        provider: providerId,
        model: providerModel(env, providerId, 'text'),
        imageModel: providerModel(env, providerId, 'image'),
      };
      // Pilot visibility: while the Model Studio pilot runs, the status
      // reports the free-quota burn per active model so the remaining
      // capacity is visible before it runs out.
      if (body.videoGeneration === 'enabled' && providerId === MODEL_STUDIO_PROVIDER_ID &&
          env.IFUND_VIDEO_ALLOW_PAID_MODELS !== 'enabled') {
        const models = [...new Set([body.model, body.imageModel])];
        body.pilot = [];
        for (const model of models) {
          const quota = FREE_QUOTA_SECONDS[model];
          if (quota === undefined) continue;
          const used = await pilotUsedSeconds(env, fetcher, model);
          body.pilot.push({
            model, quota_seconds: quota, used_seconds: used,
            remaining_seconds: Math.max(0, quota - used),
          });
        }
        body.pilot_expires_at = pilotExpiresAt(env);
      }
      return response(200, body);
    }
    if (path === '/api/ai/videos/generate') {
      if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
      return await submitJob(request, env, fetcher);
    }
    if (path === '/api/ai/videos/concierge/pending') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      return await conciergePending(request, env, fetcher);
    }
    const conciergeMatch = /^\/api\/ai\/videos\/concierge\/jobs\/([0-9a-f-]{36})\/(complete|fail)$/i.exec(path);
    if (conciergeMatch && UUID.test(conciergeMatch[1])) {
      if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
      const requestId = conciergeMatch[1].toLowerCase();
      return conciergeMatch[2] === 'complete'
        ? await conciergeComplete(request, env, fetcher, requestId)
        : await conciergeFail(request, env, fetcher, requestId);
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
