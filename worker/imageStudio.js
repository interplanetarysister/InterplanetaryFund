import { authenticatedUser, response } from './reads.js';
import { verifyOwnerAIConsent } from './aiConsent.js';
import { reserveTrialContent, completeTrialContent, releaseTrialContent } from './trialAiContent.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { verifyImageLettering, MAX_IMAGE_GENERATIONS } from './imageTextCheck.js';

export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const IMAGE_STYLES = Object.freeze({
  interstellar: 'atmospheric nebula light, deep-space details and luminous gradients',
  futuristic: 'clean optimistic science-fiction editorial illustration',
  cyberpunk: 'cinematic neon lighting and sharp graphic textures',
  comic: 'colorful graphic-novel ink contours and expressive illustration',
});
const CANONICAL_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Appended when a render comes back with lettering: the retry must remove
// every trace of text-like marks, not merely try the same prompt again.
const CORRECTIVE_NO_LETTERING =
  ' IMPORTANT: the previous attempt contained letters or word-like marks. ' +
  'This attempt must contain absolutely no letters, words, numbers, signs, ' +
  'labels, typography or letter-like shapes anywhere; every surface that ' +
  'could hold text must be blank and smooth.';

export function imageAIReady(env) {
  return env?.IFUND_IMAGE_AI_ENABLED === 'enabled' &&
    typeof env?.AI?.run === 'function' &&
    env.SUPABASE_URL === CANONICAL_URL &&
    typeof env.SUPABASE_PUBLISHABLE_KEY === 'string' &&
    env.SUPABASE_PUBLISHABLE_KEY.length >= 10;
}

export async function consumeImageQuota(env, account, fetcher = fetch) {
  const quota = await fetcher(env.SUPABASE_URL + '/rest/v1/rpc/ifund_ai_image_consume_free_quota', {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + account.jwt,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!quota.ok) return { status: 503, error: 'The verified artwork quota could not be checked.' };
  const allowed = await quota.json();
  if (allowed !== true)
    return { status: 429, error: 'Image access requires an active verified trial or subscription, and shared provider capacity may be temporarily exhausted. Try again later or check your membership.' };
  return null;
}

export function validateImageRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['title', 'description', 'style'].includes(key)))
    throw new BodyError(422, 'Describe the fundraiser before generating an image.');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (title.length < 4 || title.length > 150 ||
      description.length < 20 || description.length > 900 ||
      !Object.hasOwn(IMAGE_STYLES, input.style) ||
      /[\u0000-\u001f\u007f]/.test(title + description))
    throw new BodyError(422, 'Provide a valid campaign title, description and illustration style.');
  const prompt = [
    'Original non-photorealistic editorial artwork for a personal fundraiser.',
    'Illustration only: NO TEXT. Do not depict typography, letters, words, writing, signs, labels, numbers, logos, watermarks, or fake captions anywhere in the image. Any sign, label, book, screen or other surface that might naturally hold words must be rendered blank and smooth, with no letter-like marks on it. No invented names, no portraits of real people, no claimed donations. The application applies optional user-approved wording separately after generation.',
    'Visual style: ' + IMAGE_STYLES[input.style] + '.',
    'Campaign title for visual context: ' + title + '.',
    'What the fundraiser is about: ' + description + '.',
  ].join(' ');
  if (prompt.length > 2048) throw new BodyError(422, 'Shorten your image description.');
  return { style: input.style, prompt };
}

export function validImageBase64(value) {
  if (typeof value !== 'string' || value.length < 64 || value.length > 7_000_000 ||
      value.length % 4 !== 0 || !value.startsWith('/9j/') ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length * 3 / 4 - padding) <= MAX_IMAGE_BYTES;
}

export async function routeImageStudio(request, env, fetcher = fetch) {
  if (new URL(request.url).pathname !== '/api/ai/images/generate')
    return response(404, { error: 'Not found.' });
  if (request.method !== 'POST')
    return response(405, { error: 'Method not allowed.' });
  // Separate default-disabled feature gate. No inference or quota writes
  // without an independently approved Pages AI binding and canonical project.
  if (!imageAIReady(env))
    return response(503, { error: 'AI image generation is not currently available.' });
  let trialReceipt = null;
  let trialJwt = null;
  try {
    const input = await readJsonBody(request, 3000);
    const { style, prompt } = validateImageRequest(input);
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with a verified account to generate artwork.' });
    trialJwt = account.jwt;
    const aiConsent = await verifyOwnerAIConsent(env, account, fetcher);
    if (!aiConsent.allowed) return response(aiConsent.status, {error: aiConsent.status === 403 ? "Turn on AI Assistance in My Account to use AI artwork." : "AI permission could not be verified."});

    // Atomic database check verifies the active 24-hour/referral trial or a real paid entitlement,
    // and enforces fair-use pacing plus the shared Workers AI hard budget.
    // No browser role, referral credit or trial expiry is trusted.
    trialReceipt = await reserveTrialContent(env,account.jwt,"image",crypto.randomUUID(),fetcher);
    if (!trialReceipt.allowed) return response(
      trialReceipt.code==="trial_limit"?429:trialReceipt.code==="membership_required"?403:503,
      {error:trialReceipt.code==="trial_limit"
        ?"Your 15 trial AI creations are used. Subscribe to keep creating, or use manual campaign tools for free."
        :"Your trial generation allowance is unavailable. Manual uploads and editing remain available."});
    const quotaError = await consumeImageQuota(env, account, fetcher);
    if (quotaError) return response(quotaError.status, { error: quotaError.error });

    // Cloudflare returns a JPEG base64 image. The inference call is not proof
    // of a saved campaign cover. Saving is a separate authenticated action.
    // The image model routinely bakes lettering into scenes despite the
    // no-text prompt, often misspelled, so every render is read back with
    // the Workers AI vision model before it can be presented: a render with
    // lettering is regenerated with corrective direction (bounded), and a
    // render whose lettering cannot be verified is never finalized against
    // the member's creation allowance.
    let letteringFailure = false;
    for (let attempt = 0; attempt < MAX_IMAGE_GENERATIONS; attempt++) {
      const attemptPrompt = attempt === 0 ? prompt : prompt + CORRECTIVE_NO_LETTERING;
      const generated = await env.AI.run(IMAGE_MODEL, { prompt: attemptPrompt, steps: 4 });
      const image = generated?.image;
      if (!validImageBase64(image))
        return response(502, { error: 'The generated artwork could not be verified.' });
      const lettering = await verifyImageLettering(env, image, '');
      if (lettering.state === 'unavailable')
        return response(503, { error: 'The generated artwork could not be verified. Please try later.' });
      if (lettering.state === 'problems') { letteringFailure = true; continue; }
      if (!(await completeTrialContent(env,trialJwt,trialReceipt,fetcher)))
        return response(503,{error:"Your generated artwork could not be finalized. No campaign was changed."});
      trialReceipt = null;
      return response(200, {
        mime_type: 'image/jpeg', image_base64: image, style, generated: true,
        model: IMAGE_MODEL, lettering_check: 'passed',
      });
    }
    return response(502, { error: letteringFailure
      ? 'The artwork generator kept adding misspelled lettering, so no image was accepted and your creation was not finalized. Please try again.'
      : 'The generated artwork could not be verified.' });
  } catch (cause) {
    if (cause instanceof BodyError)
      return response(cause.status, { error: cause.message });
    return response(503, { error: 'Artwork generation could not be completed. Please try later.' });
  } finally {
    if (trialReceipt) await releaseTrialContent(env,trialJwt,trialReceipt,fetcher);
  }
}
