import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("guest users can browse public campaigns, social posts, blogs, publications and help articles", () => {
  for (const [route, component] of [
    ["/", "Home"], ["/discover", "Discover"], ["/campaign/:id", "CampaignDetail"],
    ["/social", "SocialRoute"], ["/community", "SocialFeedPage"],
    // Sprint 8 (2026-11-25): /blogs and /news fold into IFund Social as the
    // Stories and News tabs; the routes stay public redirects.
    ["/blogs", "Navigate"], ["/news", "Navigate"], ["/u/:id", "PublicMemberProfile"], ["/blogs/:id", "BlogArticle"],
    ["/publications/:id", "PublicationArticle"],
    ["/help", "Help"], ["/help/:slug", "HelpArticle"],
    ["/about", "About"], ["/terms", "Terms"], ["/privacy", "Privacy"],
  ]) {
    const entry = app.split("\n").find(line => line.includes('path="' + route + '"'));
    assert.ok(entry, "Missing public route " + route);
    assert.ok(entry.includes("<" + component), route + " must render " + component);
    assert.ok(!entry.includes("<MemberAccess>"), route + " must not require authentication");
  }
  const blogs = app.split("\n").find(line => line.includes('path="/blogs"'));
  assert.ok(blogs?.includes('to="/social?tab=stories"'), "/blogs must redirect to the Social stories tab");
  const news = app.split("\n").find(line => line.includes('path="/news"'));
  assert.ok(news?.includes('to="/social?tab=news"'), "/news must redirect to the Social news tab");
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
