// AI caption wording for generated media (Media Studio artwork and
// campaign cover art). The image model still draws NO lettering — iFund
// renders the approved caption itself — but the WORDING may now be drafted
// by the AI at the member's request. Every draft must pass two
// deterministic checks before it is returned:
//   1. the caption coherence guard (captionQuality.mjs): real words only,
//      no invented words, letter salad, keyboard mash or garbled tokens;
//   2. the public-facing discretion scan (campaignCopyQuality.mjs): no
//      pleading, no internal-objective leakage, no echo of the member's
//      private need wording.
// A failing draft gets ONE corrective regeneration; a second failure
// returns the clean fallback (the campaign title itself) labeled as such,
// so gibberish never reaches a member's media. A provider failure is an
// honest 503, never a silently substituted caption.
//
// The text model runs on the free daily Neuron allocation (unlike the
// per-second-billed video model), and the route is member- and
// consent-gated with a 100-character output cap, so it needs no separate
// enable flag: readiness is the AI binding plus the canonical project
// configuration. Caption drafting is wording help attached to an
// already allowance-gated creation; it does not consume a creation credit.
import { response } from './reads.js';
import { verifyOwnerAIConsent } from './aiConsent.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { member } from './media/privateDocuments.js';
import {
  findCaptionNonsense, fallbackCaption, CAPTION_MAX_CHARS,
} from '../apps/web/src/lib/captionQuality.mjs';
import {
  findPublicFacingViolations,
} from '../apps/web/src/lib/campaignCopyQuality.mjs';

export const CAPTION_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CANONICAL_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';

export function captionModel(env) {
  return typeof env?.IFUND_CAPTION_MODEL === 'string' && env.IFUND_CAPTION_MODEL.trim()
    ? env.IFUND_CAPTION_MODEL.trim() : CAPTION_MODEL;
}

export function captionAIReady(env) {
  return typeof env?.AI?.run === 'function' &&
    env?.SUPABASE_URL === CANONICAL_URL &&
    typeof env?.SUPABASE_PUBLISHABLE_KEY === 'string' &&
    env.SUPABASE_PUBLISHABLE_KEY.length >= 10;
}

export function validateCaptionRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['title', 'description', 'kind'].includes(key)))
    throw new BodyError(422, 'Caption context is required.');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length < 4 || title.length > 150 || /[\u0000-\u001f\u007f]/.test(title))
    throw new BodyError(422, 'A campaign title of 4 to 150 characters is required.');
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length > 900 || /[\u0000-\u001f\u007f]/.test(description))
    throw new BodyError(422, 'Caption context is too long.');
  const kind = input.kind === undefined ? 'image' : input.kind;
  if (kind !== 'image' && kind !== 'video')
    throw new BodyError(422, 'Caption kind must be image or video.');
  return { title, description, kind };
}

function contextWords({ title, description }) {
  return (title + ' ' + description).split(/[^A-Za-z'’-]+/).filter(Boolean);
}

export function cleanCaptionCandidate(raw) {
  if (typeof raw !== 'string') return '';
  const line = raw.split(/\r?\n/).map(s => s.trim()).find(s => s.length > 0) || '';
  return line.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
}

// Returns a list of rejection reasons for a candidate caption; empty
// means the caption may be shown to the member for approval.
export function captionRejectionReasons(candidate, context) {
  if (!candidate) return ['empty'];
  if (candidate.length > CAPTION_MAX_CHARS) return ['too long'];
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return ['control characters'];
  const reasons = [];
  if (findCaptionNonsense(candidate, { contextWords: contextWords(context) }).length)
    reasons.push('nonsense wording');
  if (findPublicFacingViolations(candidate, context.description || context.title).length)
    reasons.push('public-facing discretion');
  return reasons;
}

function captionMessages(context, correction) {
  return [
    {
      role: 'system',
      content:
        'You write ONE short caption (at most 100 characters) to print on a fundraiser\'s ' +
        context.kind + '. Use only common, real English words, spelled correctly — never invent ' +
        'words, letter combinations, or gibberish. Write like a professional campaign manager: ' +
        'fresh, concrete, warm wording about the visible scene and the change it supports. Never ' +
        'beg or plead ("help me", "please donate", "we need money"), never mention internal goals ' +
        'like signups or users, never state a fundraising total as an appeal, and never claim the ' +
        'scene is a real person or event. No hashtags unless one is natural. Return only the caption.',
    },
    {
      role: 'user',
      content:
        'Campaign title: ' + context.title +
        (context.description ? '\nWhat the fundraiser supports: ' + context.description : '') +
        (correction
          ? '\nYour previous draft was rejected (' + correction + '). Write a completely new caption using only simple, common, correctly spelled words.'
          : ''),
    },
  ];
}

async function draftCaption(env, context, correction) {
  const result = await env.AI.run(captionModel(env), {
    messages: captionMessages(context, correction),
    max_tokens: 120, temperature: correction ? 0.3 : 0.7,
  });
  return cleanCaptionCandidate(result?.response ?? result?.result?.response ?? '');
}

async function generateCaption(request, env, fetcher) {
  if (!captionAIReady(env))
    return response(503, { error: 'AI caption suggestions are not currently available.' });
  const context = validateCaptionRequest(await readJsonBody(request, 3000));
  const actor = await member(request, env, fetcher);
  const aiConsent = await verifyOwnerAIConsent(env, { uid: actor.id, jwt: actor.jwt }, fetcher);
  if (!aiConsent.allowed) return response(aiConsent.status, {
    error: aiConsent.status === 403
      ? 'Turn on AI Assistance in My Account to use AI caption suggestions.'
      : 'AI permission could not be verified.' });

  let candidate;
  try {
    candidate = await draftCaption(env, context, null);
  } catch {
    return response(503, { error: 'Caption suggestion is temporarily unavailable.' });
  }
  let reasons = captionRejectionReasons(candidate, context);
  if (!reasons.length) return response(200, { caption: candidate, source: 'ai' });

  try {
    candidate = await draftCaption(env, context, reasons.join(', '));
  } catch {
    return response(503, { error: 'Caption suggestion is temporarily unavailable.' });
  }
  reasons = captionRejectionReasons(candidate, context);
  if (!reasons.length) return response(200, { caption: candidate, source: 'ai_corrected' });

  // Gibberish must never reach a member's media: fall back to the
  // campaign's own factual title, labeled so the UI can say what happened.
  return response(200, { caption: fallbackCaption(context.title), source: 'fallback' });
}

export async function routeCaptionGeneration(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/ai/captions/status') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      return response(200, {
        captionAi: captionAIReady(env) ? 'enabled' : 'not_configured',
        model: captionModel(env),
      });
    }
    if (path === '/api/ai/captions/generate') {
      if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
      return await generateCaption(request, env, fetcher);
    }
    return response(404, { error: 'Not found.' });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 503
      ? error.status : 503;
    return response(status, {
      error: status === 503 && !error?.status
        ? 'Caption suggestion service is temporarily unavailable.'
        : String(error.message).slice(0, 240),
    });
  }
}
