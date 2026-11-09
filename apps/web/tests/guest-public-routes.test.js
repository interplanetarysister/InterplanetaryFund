import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("guest users can browse public campaigns, social posts, blogs, publications and help articles", () => {
  for (const [route, component] of [
    ["/", "Home"], ["/discover", "Discover"], ["/campaign/:id", "CampaignDetail"],
    ["/social", "SocialFeedPage"], ["/community", "SocialFeedPage"],
    ["/blogs", "Blogs"], ["/blogs/:id", "BlogArticle"],
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

test("only member workspaces and private account actions require authentication", () => {
  for (const route of ["/dashboard", "/campaigns", "/campaigns/:id/edit", "/profile", "/connections", "/following", "/notifications", "/inbox", "/publication", "/my-blog"]) {
    const entry = app.split("\n").find(line => line.includes('path="' + route + '"'));
    assert.ok(entry?.includes("<MemberAccess>"), route + " must stay private");
  }
  const create = app.split("\n").find(line => line.includes('path="/create"'));
  assert.ok(create?.includes("<CreateCampaign />") && !create.includes("<MemberAccess>"), "guest campaign writing must be accessible");
});
