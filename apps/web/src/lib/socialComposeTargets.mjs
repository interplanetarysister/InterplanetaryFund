// Explicit third-party compose intents. These open a user's own browser
// session and NEVER silently post or imply provider OAuth grants.
// Keep one source of truth for external manual fallback publishing.
export function socialComposeTargets(body) {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return [];
  const graphemes = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length
    : [...text].length;
  const targets = [];
  if (graphemes <= 280) targets.push({
    id: "x", label: "Review draft on X",
    href: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text),
  });
  if (graphemes <= 300) targets.push({
    id: "bluesky", label: "Review draft on Bluesky",
    href: "https://bsky.app/intent/compose?text=" + encodeURIComponent(text),
  });
  return targets;
}
