import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/CampaignEditor.jsx', import.meta.url), 'utf8');

test('section regeneration puts section facts ahead of optional campaign context', () => {
  const start = source.indexOf('async function regenerateSection(index)');
  const end = source.indexOf('async function save(status)', start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /const primary = instruction \+ section/);
  assert.match(body, /primary\.length \+ context\.length <= 1500 \? primary \+ context : primary/);
  assert.match(body, /\.slice\(0, 1500\)/);
  assert.ok(body.indexOf('const primary =') < body.indexOf('const context ='));
});
