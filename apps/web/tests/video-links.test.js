import test from "node:test";
import assert from "node:assert/strict";
import { videoFromUrl, videoFromText, clipDescription } from "../src/lib/videoLinks.js";
const ID = "dQw4w9WgXcQ";

test("supported YouTube links reconstruct a privacy-enhanced player with no user parameters", () => {
  for (const url of [`https://youtu.be/${ID}`, `https://www.youtube.com/watch?v=${ID}`, `https://m.youtube.com/shorts/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`, `https://youtube.com/live/${ID}?autoplay=1&access_token=synthetic`]) {
    const video = videoFromUrl(url);
    assert.equal(video?.type, "youtube", url);
    assert.equal(video.src, "https://www.youtube-nocookie.com/embed/" + ID);
    assert.equal(video.url, "https://www.youtube.com/watch?v=" + ID);
    assert.doesNotMatch(video.src, /autoplay|access_token|synthetic/);
  }
});
test("Vimeo accepts only exact public and player paths and drops private tokens", () => {
  for (const url of ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789?token=synthetic"]) {
    assert.deepEqual(videoFromUrl(url), {type:"vimeo",provider:"Vimeo",src:"https://player.vimeo.com/video/123456789?dnt=1",url:"https://vimeo.com/123456789"});
  }
});
test("untrusted schemes, credentials, spoofed hosts, malformed IDs and extra path segments fail closed", () => {
  for (const url of [`http://youtube.com/watch?v=${ID}`, `javascript:alert(1)`, `https://youtube.com.evil.test/watch?v=${ID}`, `https://user:password@youtube.com/watch?v=${ID}`, `https://youtube.com:8443/watch?v=${ID}`, `https://youtu.be/${ID}/private`, `https://youtube.com/embed/${ID}/other`, `https://youtube.com/watch?v=${ID}&v=aaaaaaaaaaa`, "https://vimeo.com/channels/a/123456789", "https://vimeo.com/000000", `https://youtube.com/watch?v=invalid`, `https://youtube.com\\@evil.test/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}\n`, "https://localhost/public/video.mp4", "https://127.0.0.1/clip.mp4", "https://example.test/clip.mp4"]) assert.equal(videoFromUrl(url), null, url);
});
test("direct video needs an exact approved public HTTPS origin and path prefix", () => {
  const options = { directSources:[{origin:"https://media.example.test",pathPrefix:"/public/videos/"}] };
  assert.equal(videoFromUrl("https://media.example.test/public/videos/clip.mp4",options)?.type,"direct");
  for (const url of ["https://media.example.test/private/clip.mp4","https://media.example.test/public/videos/clip.mp4?token=secret","https://media.example.test.evil/public/videos/clip.mp4","https://media.example.test/public/videos/%2fprivate.mp4","https://media.example.test/public/videos/image.png"]) assert.equal(videoFromUrl(url,options),null,url);
  assert.equal(videoFromUrl("https://localhost/public/videos/clip.mp4",{directSources:[{origin:"https://localhost",pathPrefix:"/public/videos/"}]}),null);
});
test("text discovery tolerates prose punctuation and descriptions never repeat video query strings", () => {
  assert.equal(videoFromText(`Please watch (https://youtu.be/${ID}).`)?.type,"youtube");
  assert.equal(videoFromText(`Image: https://example.test/image.png then https://vimeo.com/123456789`)?.type,"vimeo");
  assert.equal(videoFromText(null),null);
  assert.equal(clipDescription("Our public update https://youtube.com/watch?v="+ID+"&token=synthetic"),"Our public update");
  assert.equal(clipDescription("x".repeat(400)).length,350);
});
