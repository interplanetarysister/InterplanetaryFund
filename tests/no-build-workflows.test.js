import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('repository automation has no build or deployment command', () => {
  for (const path of [
    '.github/workflows/ifund-migration-tests.yml',
    '.github/workflows/migration-phase1-checks.yml',
  ]) {
    const workflow = read(path);
    assert.doesNotMatch(workflow, /npm\\s+(?:run\\s+)?build|vite\\s+build|wrangler\\s+(?:pages\\s+)?deploy|pages\\s+deploy/i, path);
  }
});

test('test workflow installs dependencies without running package lifecycle scripts', () => {
  const workflow = read('.github/workflows/ifund-migration-tests.yml');
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm --prefix apps\\/web ci --ignore-scripts/);
  assert.match(workflow, /node --test tests\\/\\*\\.test\\.js/);
  assert.match(workflow, /npm --prefix apps\\/web test/);
});
