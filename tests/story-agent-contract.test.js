import test from "node:test";
import assert from "node:assert/strict";
import { storyInput, storyOutput, storyResponseFormat } from "../worker/agents/story.js";

const requestId = "11111111-1111-4111-8111-111111111111";
const validDraft = () => ({
  titles: ["A".repeat(150), "Title B", "Title C", "Title D", "Title E"],
  summaries: ["Summary A", "Summary B"],
  story: "A complete story.",
  image_prompt: "A campaign image concept.",
});

test("story input accepts the complete section size returned by the output schema", () => {
  const input = storyInput({
    request_id: requestId,
    details: "Verified campaign facts and owner-provided context.",
    section: "S".repeat(4000),
  });
  assert.equal(input.section.length, 4000);
  assert.equal(storyResponseFormat(true).json_schema.properties.section.maxLength, 4000);
  assert.throws(() => storyInput({
    request_id: requestId,
    details: "Verified campaign facts and owner-provided context.",
    section: "S".repeat(4001),
  }), /4,000 characters/);
});

test("generated title limits match the public campaign creator and reject invalid control characters", () => {
  const output = storyOutput(JSON.stringify(validDraft()));
  assert.equal(output.titles[0].length, 150);
  assert.equal(storyResponseFormat(false).json_schema.properties.titles.items.maxLength, 150);
  const tooLong = validDraft();
  tooLong.titles[0] = "A".repeat(151);
  assert.throws(() => storyOutput(JSON.stringify(tooLong)), /incomplete draft/);
  const invalid = validDraft();
  invalid.titles[0] = "Bad\u0001title";
  assert.throws(() => storyOutput(JSON.stringify(invalid)), /incomplete draft/);
});
