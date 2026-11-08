import test from 'node:test';
import assert from 'node:assert/strict';
import { helpArticleBySlug } from '../src/lib/helpArticles.js';

test('campaign help distinguishes guest session draft from confirmed remote save', () => {
  const answer = helpArticleBySlug('create-a-campaign')?.answer;
  assert.ok(answer);
  assert.match(answer, /without signing in/);
  assert.match(answer, /not a server save/);
  assert.match(answer, /Save private draft/);
  assert.match(answer, /confirmed draft reference/);
  assert.match(answer, /Publishing, donations and AI artwork remain unavailable/);
  assert.doesNotMatch(answer, /does not offer live campaign creation/);
});
