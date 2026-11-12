import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("guest users can browse public campaigns, social posts, blogs, publications and help articles", () => {
  for (const [route, component] of [
    ["/", "Home"], ["/discover", "Discover"], ["/campaign/:id", "CampaignDetail"],
    ["/social", "SocialRoute"], ["/community", "SocialFeedPage"],
    ["/blogs", "Blogs"], ["/news", "Blogs"], ["/u/:id", "PublicMemberProfile"], ["/blogs/:id", "BlogArticle"],
    ["/publications/:id", "PublicationArticle"],
    ["/help", "Help"], ["/help/:slug", "HelpArticle"],
    ["/about", "About"], ["/terms", "Terms"], ["/privacy", "Privacy"],
  ]) {
    const entry = app.split("\n").find(line => line.includes('path="' + route + '"'));
    assert.ok(entry, "Missing public route " + route);
    assert.ok(entry.includes("<" + component), route + " must render " + component);
    assert.ok(!entry.includes("<MemberAccess>"), route + " must not require authentication");
  }
});

test("guest dashboard and editor stay public, while account data remains guarded", () => {
  for (const route of ["/campaigns", "/campaigns/:id/edit", "/profile", "/connections", "/following", "/notifications", "/inbox", "/publication", "/my-blog"]) {
    const entry = app.split("\n").find(line => line.includes('path="' + route + '"'));
    assert.ok(entry?.includes("<MemberAccess>"), route + " must stay private");
  }
  const dashboard = app.split("\n").find(line => line.includes('path="/dashboard"'));
  assert.ok(dashboard?.includes("<Dashboard />") && !dashboard.includes("<MemberAccess>"), "guest dashboard must be accessible");
  const create = app.split("\n").find(line => line.includes('path="/create"'));
  assert.ok(create?.includes("<CreateCampaign />") && !create.includes("<MemberAccess>"), "guest campaign composition must remain available before registration");
});
