// Independent architecture QA helper. Does not modify the frontend or deployment workflow.
import { readFileSync } from 'node:fs';

export function extractEntryAssets(html, origin) {
  const base = new URL(origin);
  const scripts = [];
  const styles = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const tagName = /^<script\b/i.test(tag) ? 'script' : 'link';
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
    if (tagName === 'link' && !attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) continue;
    const path = tagName === 'script' ? attrs.src : attrs.href;
    if (!path) continue;
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error(`External ${tagName} entrypoint: ${url}`);
    (tagName === 'script' ? scripts : styles).push(url.href);
  }
  if (!scripts.length || !styles.length) throw new Error('Missing same-origin script or stylesheet');
  return { scripts, styles };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [htmlPath, origin] = process.argv.slice(2);
  if (!htmlPath || !origin) throw new Error('Usage: node verify.mjs <html-file> <preview-url>');
  console.log(JSON.stringify(extractEntryAssets(readFileSync(htmlPath, 'utf8'), origin)));
}
