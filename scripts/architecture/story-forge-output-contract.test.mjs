import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGeneratedStory, acceptStoryForEditor } from './story-forge-output-contract.mjs';

test('999 characters is rejected even with two paragraphs', () => {
  const story = 'a'.repeat(497) + '\n\n' + 'b'.repeat(500);
  assert.equal(story.length, 999);
  assert.equal(inspectGeneratedStory(story).valid, false);
});
test('1000 characters with two paragraphs is accepted', () => {
  const story = 'a'.repeat(498) + '\n\n' + 'b'.repeat(500);
  assert.equal(story.length, 1000);
  assert.equal(inspectGeneratedStory(story).valid, true);
});
test('one paragraph of 1000 characters is rejected', () => {
  assert.equal(inspectGeneratedStory('x'.repeat(1000)).valid, false);
});
test('punctuation, digits and whitespace count toward length', () => {
  const story = '1'.repeat(495) + '!  \n\n' + '2'.repeat(500);
  assert.equal(story.length, 1000);
  assert.equal(inspectGeneratedStory(story).valid, true);
});
test('Windows line endings are normalized before counting', () => {
  const story = 'a'.repeat(498) + '\r\n\r\n' + 'b'.repeat(500);
  assert.equal(inspectGeneratedStory(story).characterCount, 1000);
});
test('manual content has no minimum, including empty content', () => {
  assert.equal(acceptStoryForEditor('', { origin: 'user' }).valid, true);
  assert.equal(acceptStoryForEditor('x', { origin: 'user' }).valid, true);
  assert.equal(acceptStoryForEditor('', { origin: 'ai', complete: false }).valid, true);
  assert.equal(acceptStoryForEditor('', { origin: 'ai', complete: true }).valid, false);
});
