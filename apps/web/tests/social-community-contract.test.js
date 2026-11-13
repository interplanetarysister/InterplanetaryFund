import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("community actions require database-level lifecycle checks and private writes", () => {
  const sql = source("../../../supabase/migrations/20261113010000_ifund_social_community.sql");
  assert.match(sql, /create or replace function public\.ifund_social_member_ok\(\)/);
  assert.match(sql, /public\.ifund_my_profile_settings\(\) is not null/);
  for (const name of ["ifund_social_like", "ifund_social_report", "ifund_social_reply",
    "ifund_social_friend", "ifund_social_archive_report", "ifund_social_archive_like"]) {
    assert.match(sql, new RegExp("function public\\." + name + "\\("));
  }
  assert.match(sql, /ifund_guard_social_post_insert_trigger/);
  assert.match(sql, /ifund_guard_social_post_mutation_trigger/);
  assert.match(sql, /ifund_post_has_report\(old\.id\)/);
  assert.match(sql, /review_note/);
  assert.match(sql, /Reply rate limit reached/);
  assert.match(sql, /ifund_social_archive_replies_author_rate_idx/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(auth\.uid\(\)::text,7821\)\)/);
  assert.match(sql, /ifund_my_social_draft\(\)/);
  assert.match(sql, /ifund_social_archive_reply\(/);
  assert.match(sql, /ifund_social_my_friends/);
  const fixture = source("../../../tests/social-community-migration.test.js");
  assert.match(fixture, /handle text/);
  assert.match(sql, /ifund_member_owns_active_campaign/);
  assert.match(sql, /ifund_social_archive_replies_read/);
  assert.match(sql, /Reply rate limit reached/);
  assert.match(sql, /create policy ifund_posts_public_read/);
  assert.match(sql, /public\.ifund_post_visible\(id\)/);
  assert.match(sql, /ifund_social_archive_reports r[\s\S]*r\.status in \('open','removed'\)/);
  assert.match(sql, /ifund_current_user_is_verified_admin\(\)/);
  assert.match(sql, /revoke all on public\.ifund_social_likes/);
});

test("feed and campaign links expose report, friendship, story and draft UI", () => {
  const list = source("../src/components/SocialPostList.jsx");
  const feed = source("../src/pages/SocialFeedPage.jsx");
  const profile = source("../src/pages/PublicMemberProfile.jsx");
  const campaign = source("../src/pages/CampaignDetail.jsx");
  const article = source("../src/pages/BlogArticle.jsx");
  const publication = source("../src/pages/PublicationArticle.jsx");
  assert.match(list, /reportPost\(/);
  assert.match(list, /replyToPost\(/);
  assert.match(list, /likePost\(/);
  assert.match(list, /safeExternalUrl/);
  assert.match(list, /url\.protocol === "https:"/);
  assert.match(list, /readReplies\(discussionId\)/);
  assert.match(feed, /saveServerSocialDraft/);
  assert.match(feed, /clearServerSocialDraft/);
  assert.match(feed, /localStorage\.setItem\(draftKey/);
  assert.match(feed, /shareDraftExternally/);
  assert.match(feed, /socialComposeTargets\(body\)/);
  assert.match(profile, /friendAction\(/);
  const permalink = source("../src/pages/SocialPostPage.jsx");
  const routes = source("../src/App.jsx");
  assert.match(routes, /social\/post\/:id/);
  assert.match(permalink, /getPublicSocialPost/);
  assert.match(list, /social\/post\//);
  assert.match(campaign, /ifund_public_campaign_blog_author/);
  assert.match(article, /shareStory/);
  assert.match(publication, /sharePublication/);
});

test("decorative background is noninteractive and low-contrast", () => {
  const css = source("../src/styles-sacred-social.css");
  assert.match(css, /pointer-events: none/);
  assert.match(css, /opacity: \.3/);
  assert.match(css, /radial-gradient/);
});
