/**
 * Post-generation lettering verification for AI artwork.
 *
 * Both image routes ask the image model for text-free artwork (member wording
 * is printed afterwards by the client-side exact-caption overlay, never by
 * the model). The image models still bake lettering into scenes — signs,
 * labels and pseudo-words, frequently misspelled — and until now nothing
 * checked the result: the format check proved the bytes were a JPEG, not
 * that the artwork was free of garbled text.
 *
 * This module reads the rendered lettering back with the vision model that
 * ships on the same Cloudflare Workers AI binding the image routes already
 * use (no new provider, no paid service) and compares it, word by word,
 * against the wording the design intended. Both live routes intend NO
 * lettering, so any legible word is a failure; the comparator also supports
 * an intended wording so a future text-bearing design can verify spelling
 * instead of merely detecting presence.
 *
 * Verification fails closed: if the vision model cannot be run or returns
 * nothing parseable, the artwork is "unavailable" for verification and the
 * routes refuse to present it as a finished, verified result.
 */
export const IMAGE_TEXT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/** Bounded correction policy shared by both image routes: the first render
 * plus at most two corrective regenerations per member request. */
export const MAX_IMAGE_GENERATIONS = 3;

const TRANSCRIPTION_MESSAGES = Object.freeze([
  {
    role: 'system',
    content: 'You are a lettering transcription checker for generated artwork. ' +
      'You output only the lettering you can read in the image, exactly as it ' +
      'appears, and nothing else.',
  },
  {
    role: 'user',
    content: 'Transcribe every letter, word and number visibly written ' +
      'anywhere in this image — on signs, labels, screens, books, clothing, ' +
      'posters or any other surface — exactly as spelled, one line per line ' +
      'of lettering. Do not correct spelling, do not guess unclear letters, ' +
      'and do not describe the image. If the image contains no letters, ' +
      'words or numbers at all, reply with exactly: NONE',
  },
]);

/** Case/punctuation-insensitive word list for spelling comparison. */
export function normalizeImageWords(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function wordCounts(words) {
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return counts;
}

/**
 * Compare the lettering read back from a generated image with the wording
 * the design intended (empty string = the design must contain no lettering
 * at all). A rendered word that is not in the intended wording is how a
 * misspelling shows up ("HEPL" instead of "HELP"); an intended word that
 * never rendered is a missing word. Either one fails verification.
 */
export function findRenderedTextProblems(renderedText, intendedText = '') {
  const rendered = wordCounts(normalizeImageWords(renderedText));
  const intended = wordCounts(normalizeImageWords(intendedText));
  const unexpected = [];
  const missing = [];
  for (const [word, count] of rendered) {
    const allowed = intended.get(word) || 0;
    for (let index = allowed; index < count; index++) unexpected.push(word);
  }
  for (const [word, count] of intended) {
    const present = rendered.get(word) || 0;
    for (let index = present; index < count; index++) missing.push(word);
  }
  return {
    ok: unexpected.length === 0 && missing.length === 0,
    unexpected,
    missing,
  };
}

/**
 * Interpret the vision model's reply. Returns the transcribed lettering, or
 * null when the reply is not a usable transcription. A reply of "NONE" (the
 * instructed no-lettering sentinel) transcribes to an empty string.
 */
export function parseRenderedTextTranscription(result) {
  const raw = result?.response;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  if (/^none[.!]?$/i.test(text)) return '';
  return text;
}

/**
 * Read the lettering in a generated JPEG (base64, no data-URL prefix) with
 * the Workers AI vision model and compare it with the intended wording.
 * Returns one of:
 *   { state: 'clean', renderedText }                 — safe to present
 *   { state: 'problems', renderedText, problems }    — lettering is wrong
 *   { state: 'unavailable' }                         — could not verify
 */
export async function verifyImageLettering(env, imageBase64, intendedText = '') {
  if (typeof env?.AI?.run !== 'function' || typeof imageBase64 !== 'string' || !imageBase64)
    return { state: 'unavailable' };
  let result;
  try {
    result = await env.AI.run(IMAGE_TEXT_MODEL, {
      messages: TRANSCRIPTION_MESSAGES,
      image: 'data:image/jpeg;base64,' + imageBase64,
      max_tokens: 220,
      temperature: 0,
    });
  } catch {
    return { state: 'unavailable' };
  }
  const renderedText = parseRenderedTextTranscription(result);
  if (renderedText === null) return { state: 'unavailable' };
  const problems = findRenderedTextProblems(renderedText, intendedText);
  if (!problems.ok) return { state: 'problems', renderedText, problems };
  return { state: 'clean', renderedText };
}
