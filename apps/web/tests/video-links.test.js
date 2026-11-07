import test from "node:test";
import assert from "node:assert/strict";
import { videoFromUrl, videoFromText } from "../src/lib/videoLinks.js";

const id = "dQw4w9WgXcQ";
for (const url of [
  "https://www.youtube.com/watch?v=" + id,
  "https://youtu.be/" + id,
  "https://youtube.com/shorts/" + id,
  "https://m.youtube.com/live/" + id,
  "https://www.youtube.com/embed/" + id,
]) {
  test("supports YouTube video URL " + url, () => {
    assert.deepEqual(videoFromUrl(url)?.src, "https://www.youtube-nocookie.com/embed/" + id);
    assert.equal(videoFromUrl(url)?.type, "youtube");
  });
}
test("extracts YouTube from published post text", () => {
  assert.equal(videoFromText("A cause worth supporting\nhttps://youtu.be/" + id)?.type, "youtube");
});
test("accepts public HTTPS direct video", () => {
  assert.equal(videoFromUrl("https://example.org/clip.mp4")?.type, "direct");
});
test("rejects fake YouTube domains and unsafe links", () => {
  for (const url of ["https://youtube.com.evil.example/watch?v=" + id, "http://youtu.be/" + id, "javascript:alert(1)", "https://youtu.be/invalid", "https://example.com/movie.mp4.evil"]) {
    assert.equal(videoFromUrl(url), null);
  }
});
