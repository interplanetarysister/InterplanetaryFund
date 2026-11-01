import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url);
const assetsDir = new URL('./assets/', dist);
const html = readFileSync(new URL('./index.html', dist), 'utf8');

const entryMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i)
  || html.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]+type=["']module["']/i);
assert.ok(entryMatch, 'production index.html must reference a module entry bundle');

const entryName = entryMatch[1].split('/').pop();
const entryPath = new URL(`./assets/${entryName}`, dist);
const entryBytes = statSync(entryPath).size;
const maxEntryBytes = 500 * 1024;
const maxLazyChunkBytes = 1500 * 1024;

const jsFiles = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, bytes: statSync(new URL(`./assets/${name}`, dist)).size }))
  .sort((a, b) => b.bytes - a.bytes);

assert.ok(
  entryBytes <= maxEntryBytes,
  `initial production entry bundle is too large: ${entryName} is ${entryBytes} bytes (limit ${maxEntryBytes})`,
);
assert.ok(
  jsFiles.every((file) => file.bytes <= maxLazyChunkBytes),
  'production JavaScript chunk budget exceeded:\n' +
    jsFiles.filter((file) => file.bytes > maxLazyChunkBytes).map((file) => `${file.name}: ${file.bytes}`).join('\n'),
);

const cssFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.css'));
for (const name of cssFiles) {
  const css = readFileSync(new URL(`./assets/${name}`, dist), 'utf8');
  assert.doesNotMatch(css, /:hoverbutton|:focusbutton|:disabledbutton/);
  assert.doesNotMatch(css, /\[data-state=["'][^"']+["']\]button/);
}

console.log(
  `Production build output verified: entry ${entryName} ${entryBytes} bytes (limit ${maxEntryBytes}); largest JS chunk ${jsFiles[0]?.name || 'none'} ${jsFiles[0]?.bytes || 0} bytes (lazy limit ${maxLazyChunkBytes}); compiled CSS selectors clean.`,
);