// Node 20-compatible loader for repository TypeScript files that are authored
// as standards-compliant JavaScript (no type syntax). This avoids Node 22-only
// --experimental-strip-types while preserving the same source under test.
import { readFile } from 'node:fs/promises';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    return {
      format: 'module',
      source: await readFile(new URL(url), 'utf8'),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
