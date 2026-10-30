import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('repository automation has no build or deployment command', () => {
  const forbidden = [
    'npm run build',
    'npm build',
    'vite build',
    'wrangler deploy',
    'wrangler pages deploy',
    'pages deploy',
  ];
  for (const path of [
    '.github/workflows/ifund-migration-tests.yml',
    '.github/workflows/migration-phase1-checks.yml',
  ]) {
    const workflow = read(path).toLowerCase();
    for (const command of forbidden) {
      assert.equal(workflow.includes(command), false, path + ' contains ' + command);
    }
  }
});

test('test workflow installs dependencies without running package lifecycle scripts', () => {
  const workflow = read('.github/workflows/ifund-migration-tests.yml');
  assert.ok(workflow.includes('npm ci --ignore-scripts'));
  assert.ok(workflow.includes('npm --prefix apps/web ci --ignore-scripts'));
  assert.ok(workflow.includes('node --test tests/*.test.js'));
  assert.ok(workflow.includes('npm --prefix apps/web test'));
});
