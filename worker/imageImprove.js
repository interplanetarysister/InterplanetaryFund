import { authenticatedUser, response } from './reads.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { imageAIReady, consumeImageQuota, validateImageRequest, validImageBase64 } from './imageStudio.js';

export const IMAGE_EDIT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_REFERENCE_BASE64 = 1_050_000;

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
    const quotaError = await consumeImageQuota(env, account, fetcher);
    if (quotaError) return response(quotaError.status, { error: quotaError.error });

    const form = new FormData();
    form.append('prompt',
      ('Create an illustrated enhancement using input_image_0 as the reference. ' +
      'Preserve the meaningful content, do not imply a manufactured event or actual beneficiary photograph. ' +
      'Remove existing text or logos rather than inventing them. ' + prompt).slice(0,2048));
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
    return response(200, {
      mime_type: 'image/jpeg', image_base64: image,
      style, generated: true, improved: true, model: IMAGE_EDIT_MODEL,
    });
  } catch (cause) {
    if (cause instanceof BodyError) return response(cause.status, { error: cause.message });
    return response(503, { error: 'Image improvement could not be completed. Please try later.' });
  }
}
