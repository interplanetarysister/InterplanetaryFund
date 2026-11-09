import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const workflowDirectory = new URL('../.github/workflows/', import.meta.url);
const workflowFiles = readdirSync(workflowDirectory).filter(name => /\.ya?ml$/i.test(name));

const forbiddenBuildOrDeployCommands = [
  /\bnpm(?:\s+--prefix\s+\S+)?\s+(?:run\s+)?build\b/i,
  /\bvite\s+build\b/i,
  /\bwrangler(?:\s+pages)?\s+deploy\b/i,
  /\bpages\s+deploy\b/i,
  /\bcloudflare\s+pages\s+build\b/i,
  /\bgradlew?\s+(?:assemble|bundle|build)\b/i,
  /\bnpx\s+cap\s+sync\b/i,
];

test('non-preview GitHub Actions workflows do not invoke build, package, or deploy commands', () => {
  assert.ok(workflowFiles.length > 0, 'expected checked-in GitHub Actions workflows');
  for (const file of workflowFiles.filter(name => name !== 'web-preview-build.yml')) {
    const workflow = readFileSync(new URL('../.github/workflows/' + file, import.meta.url), 'utf8');
    for (const pattern of forbiddenBuildOrDeployCommands) {
      assert.equal(pattern.test(workflow), false, file + ' contains forbidden command ' + pattern);
    }
  }
});

test('dedicated web preview workflow compiles but never deploys', () => {
  const workflow = read('.github/workflows/web-preview-build.yml');
  assert.ok(workflow.includes('migration/build-completeness-gates-20261029'));
  assert.ok(workflow.includes('CF_PAGES: "1"'));
  assert.ok(workflow.includes('npm run build --prefix apps/web'));
  assert.equal(/\\b(?:wrangler|pages)\\s+deploy\\b/i.test(workflow), false);
  assert.equal(workflow.includes('production_deployments_enabled'), false);
});

test('migration workflow contains static tests and audits only', () => {
  const workflow = read('.github/workflows/ifund-migration-tests.yml');
  assert.ok(workflow.includes('node --test tests/*.test.js'));
  assert.ok(workflow.includes('npm --prefix apps/web test'));
  assert.ok(workflow.includes('node --check'));
  assert.equal(workflow.includes('vite build'), false);
  assert.equal(workflow.includes('npm run build'), false);
});

test('all staged Worker Wrangler configs fail closed and expose no routes', () => {
  const paths = [
    'wrangler.jsonc',
    'wrangler.automations.jsonc',
    'wrangler.notifications.jsonc',
  ];
  const configs = Object.fromEntries(paths.map(path => [path, JSON.parse(read(path))]));
  for (const [path, config] of Object.entries(configs)) {
    assert.equal(config.workers_dev, false, path + ' must not expose a workers.dev endpoint');
    assert.equal(config.keep_vars, false, path + ' must not preserve conflicting dashboard variables');
    assert.equal(Object.hasOwn(config, 'routes'), false, path + ' must not attach production routes');
  }
  assert.equal(configs['wrangler.automations.jsonc'].vars.IFUND_AUTOMATIONS_ENABLED, 'disabled');
  assert.equal(configs['wrangler.automations.jsonc'].vars.IFUND_SCHEDULES_ENABLED, 'disabled');
  assert.equal(configs['wrangler.automations.jsonc'].vars.IFUND_AUTOMATION_RELEASE_APPROVED, 'false');
  assert.equal(configs['wrangler.notifications.jsonc'].vars.MIGRATION_API_PREVIEW, 'disabled');
  assert.equal(configs['wrangler.notifications.jsonc'].vars.IFUND_NOTIFICATIONS_ENABLED, 'disabled');
});
