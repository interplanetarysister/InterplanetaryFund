import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, 'docs/migration/FRONTEND_PAGE_STATUS.json'), 'utf8'));
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');

function collect(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    return item.isDirectory() ? collect(path) : /\.(js|jsx|ts|tsx)$/.test(path) ? [path] : [];
  });
}

test('inventory contains every one of the 57 source frontend pages', () => {
  assert.equal(manifest.total, 57);
  assert.equal(manifest.pages.length, 57);
  assert.equal(new Set(manifest.pages.map((p) => p.name)).size, 57);
});
test('new frontend routes exist for About, Privacy and Terms', () => {
  for (const page of ['About', 'Privacy', 'Terms']) {
    assert.ok(manifest.pages.some((p) => p.name === page && p.status === 'ported_static_needs_legal_review'));
    assert.match(app, new RegExp('<' + page + '\\s*\\/?>'));
  }
});
test('deployed frontend source does not import Base44 or Convex runtime SDKs', () => {
  const offenders = collect('src').filter((path) => {
    const source = readFileSync(join(root, path), 'utf8');
    return /from\s*['\"](?:@base44\/|[^'\"]*base44Client)|from\s*['\"][^'\"]*convex\//.test(source);
  });
  assert.deepEqual(offenders, []);
});

test('restored campaign wizard keeps the four original steps and resume-draft route', () => {
  const editor = readFileSync(join(root, 'src/pages/CampaignEditor.jsx'), 'utf8');
  for (const label of ['Your Details', 'Basics', 'Your Story', 'Launch']) {
    assert.ok(editor.includes(label), label);
  }
  assert.ok(editor.includes('params.get("draft")'));
  assert.ok(editor.includes('.eq("owner_id", accountId)'));
  assert.ok(editor.includes('Drafts stay private'));
});
test('the independent dashboard and legacy dashboard URL are wired', () => {
  assert.ok(app.includes('import Dashboard from "./pages/Dashboard";'));
  assert.ok(app.includes('path="/dashboard" element={<Dashboard user={user} />}'));
});
test('campaign editor has no old Base44 service calls', () => {
  const editor = readFileSync(join(root, 'src/pages/CampaignEditor.jsx'), 'utf8');
  assert.doesNotMatch(editor, /base44\.functions|@\/api\/base44Client/);
});
