import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/CampaignEditor.jsx', import.meta.url), 'utf8');

test('edited story joins paragraphs with newline escapes, not literal backslash-n text', () => {
  assert.ok(source.includes('storyParts.join("\\n\\n")'));
  assert.ok(!source.includes('storyParts.join("\\\\n\\\\n")'));
  assert.equal(['First paragraph', 'Second paragraph'].join('\n\n'), 'First paragraph\n\nSecond paragraph');
});
