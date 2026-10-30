import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('CI workflows may compile repairs but do not deploy production', () => {
  const forbidden = [
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

test('test workflow installs dependencies and compiles the independent web app', () => {
  const workflow = read('.github/workflows/ifund-migration-tests.yml');
  assert.ok(workflow.includes('npm ci --ignore-scripts'));
  assert.ok(workflow.includes('npm --prefix apps/web ci --ignore-scripts'));
  assert.ok(workflow.includes('node --test tests/*.test.js'));
  assert.ok(workflow.includes('npm --prefix apps/web test'));
  const webTests = workflow.indexOf('npm --prefix apps/web test');
  const webBuild = workflow.indexOf('npm --prefix apps/web exec -- vite build');
  assert.ok(webBuild > webTests, 'web compilation must run after regression tests');
});
