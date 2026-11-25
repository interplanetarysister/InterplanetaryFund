import test from "node:test";
import assert from "node:assert/strict";
import { publicCampaignVideoEntries, unifiedSocialEntries } from "../src/lib/unifiedSocialFeed.js";

const id = "11111111-1111-4111-8111-111111111111";
const clip = "https://youtu.be/dQw4w9WgXcQ";
const campaign = { id, status: "active", title: "Public mission", summary: "Mission update",
  story: clip, created_at: "2026-11-24T18:00:00Z" };
const post = { id: "post-" + id, body: "Watch " + clip,
  posted_at: "2026-11-24T19:00:00Z" };

test("public member video posts and active campaign videos share one chronological feed", () => {
  const entries = unifiedSocialEntries([post], [campaign]);
  assert.deepEqual(entries.map(item => item.type), ["social-post", "campaign-media"]);
  assert.deepEqual(entries.map(item => item.id), [post.id, "campaign-" + id]);
  assert.equal(entries[1].video.provider, "YouTube");
  assert.equal(entries[1].href, "/campaign/" + id);
});

test("no duplicate entries across repeated public reads", () => {
  const result = unifiedSocialEntries([post, post], [campaign, campaign]);
  assert.equal(result.length, 2);
});

test("private, removed, draft and unverified campaigns never enter the public timeline", () => {
  const rows = unifiedSocialEntries([
    { ...post, visibility: "private" }, { ...post, status: "removed" },
    { ...post, id: "private-post" },
  ], [
    { ...campaign, status: "draft" },
    { ...campaign, status: "paused" },
    { ...campaign, preview_only: true },
    { ...campaign, id: "legacy-private" },
  ]);
  assert.deepEqual(rows, []);
});

test("video-only selection rejects unapproved direct-file providers", () => {
  assert.deepEqual(publicCampaignVideoEntries([
    { ...campaign, story: "", cover_image_url: "https://example.com/private.mp4" },
  ]), []);
  assert.throws(() => publicCampaignVideoEntries(null), /Invalid/);
  assert.throws(() => unifiedSocialEntries(null, []), /Invalid/);
});

test("archived external network posts retain source identity and are not duplicated", () => {
  const archived = { id: "archive-public-123", body: "Published on an authorized public source",
    source_platform: "bluesky", external_url: "https://bsky.app/profile/example/post/abc",
    posted_at: "2026-11-24T20:00:00Z" };
  const rows = unifiedSocialEntries([post, archived, archived], [campaign]);
  assert.equal(rows[0].id, archived.id);
  assert.equal(rows[0].source_platform, "bluesky");
  assert.equal(rows.length, 3);
});

test("active campaign images join the timeline without manufacturing playable videos", () => {
  const rows = unifiedSocialEntries([], [{...campaign, story: "", cover_image_url: "https://images.example.org/public/campaign.jpg"}]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, "campaign-media");
  assert.equal(rows[0].video, null);
  assert.equal(rows[0].image, "https://images.example.org/public/campaign.jpg");
});
