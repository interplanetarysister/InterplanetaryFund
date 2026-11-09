/**
 * Story Forge output acceptance — AI-generated COMPLETE stories only.
 * Never apply these limits to organizer-authored content, drafts or publishing.
 * This module is pure, local, and does not call any credit-consuming service.
 */
export const AI_STORY_MIN_CHARACTERS = 1000;
export const AI_STORY_MIN_PARAGRAPHS = 2;

export function inspectGeneratedStory(story) {
  const normalized = typeof story === 'string' ? story.replace(/\r\n?/g, '\n') : '';
  // A paragraph break is an empty line, allowing whitespace on the line.
  const paragraphs = normalized.split(/\n[\t ]*\n+/).filter(part => part.trim().length > 0);
  const characterCount = normalized.length;
  const paragraphCount = paragraphs.length;
  return {
    characterCount,
    paragraphCount,
    valid: characterCount >= AI_STORY_MIN_CHARACTERS && paragraphCount >= AI_STORY_MIN_PARAGRAPHS,
    missingCharacters: Math.max(0, AI_STORY_MIN_CHARACTERS - characterCount),
    missingParagraphs: Math.max(0, AI_STORY_MIN_PARAGRAPHS - paragraphCount),
  };
}

export function acceptStoryForEditor(story, { origin = 'user', complete = true } = {}) {
  // User edits and section-level generation are not complete AI stories.
  if (origin !== 'ai' || !complete) return { valid: true, checked: false };
  return { ...inspectGeneratedStory(story), checked: true };
}
