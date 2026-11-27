import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OAUTH_CONSENT_IDS,
  OAUTH_CONSENT_PROVIDERS,
  OAUTH_CONSENT_SHARED,
  oauthConsent,
  persistentLinkAgreement,
} from "../src/lib/oauthConsent.mjs";
import { OAUTH_PLATFORM_IDS } from "../src/lib/connectionCatalog.mjs";
import { oauthProviders } from "../../../worker/oauth.js";

// Raw scope lists exactly as defined in worker/oauth.js. If a scope changes
// in the worker, this test fails on purpose: update the worker, the consent
// copy in oauthConsent.mjs, and this pin together.
const EXPECTED_SCOPES = {
  google: ["openid", "email", "profile"],
  youtube: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
  ],
  linkedin: ["openid", "profile", "email", "w_member_social"],
  discord: ["identify"],
  github: ["read:user"],
  twitch: ["user:read:email"],
  slack: ["openid", "profile"],
  patreon: ["identity"],
  eventbrite: [],
  pinterest: ["user_accounts:read"],
  reddit: ["identity"],
  x: ["users.read", "tweet.read", "offline.access"],
  tiktok: ["user.info.basic", "video.list", "video.upload"],
  facebook_pages: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ],
  instagram: [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
  ],
};

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("the authorization request covers every OAuth provider, one by one", () => {
  assert.deepEqual([...OAUTH_CONSENT_IDS].sort(), [...oauthProviders].sort());
  assert.deepEqual(
    [...OAUTH_CONSENT_IDS].sort(),
    [...new Set(Object.values(OAUTH_PLATFORM_IDS))].sort(),
  );
  assert.equal(OAUTH_CONSENT_PROVIDERS.length, 15);
  assert.equal(new Set(OAUTH_CONSENT_IDS).size, 15);
  for (const id of oauthProviders) {
    const entry = oauthConsent(id);
    assert.ok(entry, `${id} must have an authorization request`);
    assert.equal(entry.id, id);
    assert.ok(entry.name.length > 0);
    assert.ok(Array.isArray(entry.requests) && entry.requests.length > 0);
    assert.ok(
      entry.requests.every(
        (item) => typeof item === "string" && item.length > 0,
      ),
    );
    assert.equal(typeof entry.clientIdEnv, "string");
    assert.equal(typeof entry.clientSecretEnv, "string");
    assert.ok(entry.clientIdEnv.length > 0 && entry.clientSecretEnv.length > 0);
    assert.ok(
      entry.approvalFlag === null || typeof entry.approvalFlag === "string",
    );
  }
  assert.equal(oauthConsent("gofundme"), null);
  assert.equal(oauthConsent("kickstarter"), null);
  assert.equal(oauthConsent("unknown"), null);
});

test("consent scopes match the worker exactly, provider by provider", () => {
  for (const [id, scopes] of Object.entries(EXPECTED_SCOPES)) {
    assert.deepEqual(
      oauthConsent(id).scopes,
      scopes,
      `${id} consent scopes must match worker/oauth.js`,
    );
  }
  // The worker must actually request every scope the consent copy names.
  const worker = readFileSync(
    new URL("../../../worker/oauth.js", import.meta.url),
    "utf8",
  );
  for (const entry of OAUTH_CONSENT_PROVIDERS) {
    for (const scope of entry.scopes) {
      assert.ok(
        worker.includes("'" + scope + "'"),
        `${entry.id} scope ${scope} must appear in worker/oauth.js`,
      );
    }
  }
});

test("the request states the persistent link, storage, no-publishing, and disconnect", () => {
  assert.match(OAUTH_CONSENT_SHARED.stored, /encrypted/i);
  assert.match(OAUTH_CONSENT_SHARED.stored, /refresh token/i);
  assert.match(OAUTH_CONSENT_SHARED.persistent, /stays connected until/i);
  assert.match(OAUTH_CONSENT_SHARED.persistent, /disconnect/i);
  assert.match(OAUTH_CONSENT_SHARED.publishing, /will not post/i);
  assert.match(OAUTH_CONSENT_SHARED.publishing, /separate approval/i);
  assert.match(OAUTH_CONSENT_SHARED.disconnect, /disconnect at any time/i);
  assert.match(
    OAUTH_CONSENT_SHARED.financial,
    /never asks for financial authority/i,
  );
  // No entry may promise publishing, money movement, or follower figures.
  const allText = [
    ...OAUTH_CONSENT_PROVIDERS.flatMap((entry) => entry.requests),
    ...Object.values(OAUTH_CONSENT_SHARED),
  ].join(" ");
  assert.doesNotMatch(allText, /will post (for|on) you/i);
  assert.doesNotMatch(allText, /automatically (post|publish|share)/i);
  // The only financial-authority wording allowed is the denial itself.
  assert.doesNotMatch(allText, /grants? (IFund )?financial authority/i);
  assert.doesNotMatch(allText, /share your banking/i);
  // Gated publish/upload scopes are named as conditional, never as granted.
  assert.match(
    oauthConsent("linkedin").requests.join(" "),
    /only requested when IFund's LinkedIn posting approval is on/,
  );
  assert.match(
    oauthConsent("x").requests.join(" "),
    /only requested when IFund's X publishing approval is on/,
  );
  assert.match(
    oauthConsent("tiktok").requests.join(" "),
    /only requested when IFund's TikTok upload approval is on/,
  );
  assert.match(
    oauthConsent("youtube").requests.join(" "),
    /only requested when IFund's YouTube upload approval is on/,
  );
  assert.match(
    oauthConsent("instagram").requests.join(" "),
    /will not publish anything without your separate approval first/,
  );
  assert.match(
    oauthConsent("facebook_pages").requests.join(" "),
    /will not post anything without your separate approval first/,
  );
});

test("the persistent-link agreement names the provider and the exit", () => {
  assert.equal(
    persistentLinkAgreement("Google Account"),
    "I understand — keep Google Account connected to my iFund account until I disconnect it.",
  );
  assert.match(persistentLinkAgreement("TikTok"), /until I disconnect it/);
});

test("the consent copy holds no credential values", () => {
  const lib = read("src/lib/oauthConsent.mjs");
  assert.doesNotMatch(lib, /CLIENT_SECRET['"]?\s*[:=]\s*['"][^'"]+['"]/);
  assert.doesNotMatch(lib, /sb_secret_/);
  assert.doesNotMatch(lib, /BEGIN (RSA |EC )?PRIVATE KEY/);
});

test("Connections only starts sign-in after the authorization request is ticked", () => {
  const page = read("src/pages/Connections.jsx");
  assert.match(page, /oauthConsent/);
  assert.match(page, /persistentLinkAgreement\(selected\.name\)/);
  assert.match(page, /Authorization request for /);
  assert.match(page, /OAUTH_CONSENT_SHARED/);
  // The first click opens the request; it never fires manage("start") itself.
  assert.match(page, /onClick=\{\(\)=>requestConnect\(\)\}/);
  // manage("start") is reached only twice: inside requestConnect (after the
  // tick) and from the consent panel's continue button (disabled until ticked).
  assert.equal(page.split('manage("start")').length - 1, 2);
  // The continue action is disabled until the persistent-link box is ticked.
  assert.match(page, /disabled=\{!consentChecked \|\| Boolean\(busy\)/);
  // The request resets when the member picks another platform.
  assert.match(page, /setConsentProvider\(null\)/);
  assert.match(page, /setConsentChecked\(false\)/);
  // An unconfigured provider is named honestly instead of a generic notice.
  assert.match(page, /isn&apos;t set up yet/);
  assert.match(page, /still needs to register its \{selected\.name\} app/);
});
