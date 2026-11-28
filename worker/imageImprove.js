import { authenticatedUser, response } from './reads.js';
import { verifyOwnerAIConsent } from './aiConsent.js';
import { reserveTrialContent, completeTrialContent, releaseTrialContent } from './trialAiContent.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { imageAIReady, consumeImageQuota, validateImageRequest, validImageBase64 } from './imageStudio.js';
import { verifyImageLettering, MAX_IMAGE_GENERATIONS } from './imageTextCheck.js';

export const IMAGE_EDIT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_REFERENCE_BASE64 = 1_050_000;
// Appended when an enhanced render keeps or invents lettering: the retry
// must erase every trace of it, not redraw it more carefully.
const CORRECTIVE_REMOVE_LETTERING =
  ' IMPORTANT: the previous attempt kept or invented lettering. Remove ' +
  'every letter, word, number and logo completely in this attempt; leave ' +
  'clean blank surfaces where they were and do not draw any letter-like ' +
  'marks anywhere in the image.';

// The browser downscales user-selected images to 480px maximum before sending
// to this endpoint; the model requires reference images smaller than 512px.
// Even forged requests cannot bypass byte/content-type and quota checks.
function referenceImageBytes(value) {
  if (typeof value !== 'string' || value.length < 64 ||
      value.length > MAX_REFERENCE_BASE64 || value.length % 4 !== 0 ||
      !value.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new BodyError(422, 'Choose a valid small JPEG image to improve.');
  let decoded;
  try { decoded = atob(value); }
  catch { throw new BodyError(422, 'The selected image could not be decoded.'); }
  if (decoded.length < 64 || decoded.length > 786_432 ||
      decoded.charCodeAt(0) !== 0xff || decoded.charCodeAt(1) !== 0xd8 ||
      decoded.charCodeAt(2) !== 0xff)
    throw new BodyError(422, 'Choose a JPEG image smaller than 768 KB.');
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}

/**
 * Privacy-preserving image-to-image enhancement. The reference photo travels
 * only to the configured Cloudflare-hosted model after explicit member consent.
 * No R2/Supabase storage occurs here; owner decides whether to upload result.
 */
export async function routeImageImprove(request, env, fetcher = fetch) {
  if (new URL(request.url).pathname !== '/api/ai/images/improve')
    return response(404, { error: 'Not found.' });
  if (request.method !== 'POST')
    return response(405, { error: 'Method not allowed.' });
  if (!imageAIReady(env))
    return response(503, { error: 'AI image improvement is not currently available.' });
  let trialReceipt = null;
  let trialJwt = null;
  try {
    const input = await readJsonBody(request, 1_300_000);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['title','description','style','reference_jpeg','confirmed_rights'].includes(key)) ||
        input.confirmed_rights !== true)
      throw new BodyError(422, 'Confirm you have permission to edit and share this image.');
    const { prompt, style } = validateImageRequest({
      title: input.title, description: input.description, style: input.style,
    });
    const jpeg = referenceImageBytes(input.reference_jpeg);
    const account = await authenticatedUser(request, env, fetcher);
    if (!account)
      return response(401, { error: 'Sign in with a verified account to improve artwork.' });
    trialJwt = account.jwt;
    const aiConsent = await verifyOwnerAIConsent(env, account, fetcher);
    if (!aiConsent.allowed) return response(aiConsent.status, {error: aiConsent.status === 403 ? "Turn on AI Assistance in My Account to use AI artwork." : "AI permission could not be verified."});
    trialReceipt = await reserveTrialContent(env,account.jwt,"image_edit",crypto.randomUUID(),fetcher);
    if (!trialReceipt.allowed) return response(
      trialReceipt.code==="trial_limit"?429:trialReceipt.code==="membership_required"?403:503,
      {error:trialReceipt.code==="trial_limit"
        ?"Your 15 free AI creations for this week are used. They refresh on a rolling 7-day cycle. Subscribe to keep creating, or use manual campaign tools for free."
        :"Your AI generation allowance is unavailable. Manual uploads and editing remain available."});
    const quotaError = await consumeImageQuota(env, account, fetcher);
    if (quotaError) return response(quotaError.status, { error: quotaError.error });

    // The edit model redraws existing lettering as often as it removes it,
    // and what it redraws is frequently misspelled, so every render is read
    // back with the Workers AI vision model before it can be presented:
    // lettering triggers a corrective regeneration (bounded), and an
    // unverifiable render is never finalized against the member's allowance.
    const baseInstruction =
      'Create an illustrated enhancement using input_image_0 as the reference. ' +
      'Preserve the meaningful content, do not imply a manufactured event or actual beneficiary photograph. ' +
      'Remove all existing text, letters, numbers and logos completely rather than redrawing or inventing them; ' +
      'leave those areas as clean blank surfaces. ';
    let letteringFailure = false;
    for (let attempt = 0; attempt < MAX_IMAGE_GENERATIONS; attempt++) {
      const form = new FormData();
      form.append('prompt',
        (baseInstruction + prompt + (attempt === 0 ? '' : CORRECTIVE_REMOVE_LETTERING)).slice(0,2048));
      form.append('input_image_0', new Blob([jpeg], {type: 'image/jpeg'}), 'reference.jpg');
      form.append('width', '768');
      form.append('height', '768');
      const wrapped = new Response(form);
      const generated = await env.AI.run(IMAGE_EDIT_MODEL, {
        multipart: {
          body: wrapped.body,
          contentType: wrapped.headers.get('content-type'),
        },
      });
      const image = generated?.image;
      if (!validImageBase64(image))
        return response(502, { error: 'Improved artwork could not be verified.' });
      const lettering = await verifyImageLettering(env, image, '');
      if (lettering.state === 'unavailable')
        return response(503, { error: 'Improved artwork could not be verified. Please try later.' });
      if (lettering.state === 'problems') { letteringFailure = true; continue; }
      if (!(await completeTrialContent(env,trialJwt,trialReceipt,fetcher)))
        return response(503,{error:"Your generated artwork could not be finalized. No campaign was changed."});
      trialReceipt = null;
      return response(200, {
        mime_type: 'image/jpeg', image_base64: image,
        style, generated: true, improved: true, model: IMAGE_EDIT_MODEL,
        lettering_check: 'passed',
      });
    }
    return response(502, { error: letteringFailure
      ? 'The image editor kept producing misspelled lettering, so no image was accepted and your creation was not finalized. Please try again.'
      : 'Improved artwork could not be verified.' });
  } catch (cause) {
    if (cause instanceof BodyError) return response(cause.status, { error: cause.message });
    return response(503, { error: 'Image improvement could not be completed. Please try later.' });
  } finally {
    if (trialReceipt) await releaseTrialContent(env,trialJwt,trialReceipt,fetcher);
  }
}
