import { authenticatedUser, response } from './reads.js';
import { readJsonBody, BodyError } from './bodyLimit.js';

export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const IMAGE_STYLES = Object.freeze({
  interstellar: 'atmospheric nebula light, deep-space details and luminous gradients',
  futuristic: 'clean optimistic science-fiction editorial illustration',
  cyberpunk: 'cinematic neon lighting and sharp graphic textures',
  comic: 'colorful graphic-novel ink contours and expressive illustration',
});
const CANONICAL_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
    'Illustration only. Do not invent names, portraits of real people, donation amounts, logos, watermarks, or printed text.',
    'Visual style: ' + IMAGE_STYLES[input.style] + '.',
    'Campaign title for visual context: ' + title + '.',
    'What the fundraiser is about: ' + description + '.',
  ].join(' ');
  if (prompt.length > 2048) throw new BodyError(422, 'Shorten your image description.');
  return { style: input.style, prompt };
}

function validImageBase64(value) {
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
  if (env?.IFUND_IMAGE_AI_ENABLED !== 'enabled' ||
      typeof env?.AI?.run !== 'function' ||
      env.SUPABASE_URL !== CANONICAL_URL ||
      typeof env.SUPABASE_PUBLISHABLE_KEY !== 'string' ||
      env.SUPABASE_PUBLISHABLE_KEY.length < 10)
    return response(503, { error: 'AI image generation is not currently available.' });
  try {
    const input = await readJsonBody(request, 3000);
    const { style, prompt } = validateImageRequest(input);
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with a verified account to generate artwork.' });

    // This is an atomic, database-verified membership and free-tier attempt
    // limit. The browser cannot bypass it using a forged owner ID or JWT role.
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
    if (!quota.ok) return response(503, { error: 'The verified artwork quota could not be checked.' });
    const allowed = await quota.json();
    if (allowed !== true)
      return response(429, { error: 'The free image limit is reached. Try again after the UTC daily reset.' });

    // Cloudflare returns a JPEG base64 image. The inference call is not proof
    // of a saved campaign cover. Saving is a separate authenticated action.
    const generated = await env.AI.run(IMAGE_MODEL, { prompt, steps: 4 });
    const image = generated?.image;
    if (!validImageBase64(image))
      return response(502, { error: 'The generated artwork could not be verified.' });
    return response(200, {
      mime_type: 'image/jpeg', image_base64: image, style, generated: true,
      model: IMAGE_MODEL,
    });
  } catch (cause) {
    if (cause instanceof BodyError)
      return response(cause.status, { error: cause.message });
    return response(503, { error: 'Artwork generation could not be completed. Please try later.' });
  }
}
