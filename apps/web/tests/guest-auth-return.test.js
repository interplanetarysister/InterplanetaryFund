import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readGuestCampaignDraft,
  saveGuestCampaignDraft,
  clearGuestCampaignDraft,
  GUEST_CAMPAIGN_DRAFT_TTL_MS,
} from "../src/lib/guestCampaignDraft.js";
import {
  authCallbackUrl,
  rememberAuthReturnTo,
  callbackParameters,
  completeAuthCallback,
} from "../src/lib/authCallback.js";
import { landingAfterLogin } from "../src/lib/postLogin.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
}

test("campaign creation is public while member pages remain guarded", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<CreateCampaign \/>}/);
  assert.doesNotMatch(app, /path="\/create" element=\{<RequireAccess/);
  assert.match(app, /path="\/dashboard" element=\{<RequireAccess access="member">/);
});

test("guest drafts persist with bounded retention and sanitized fields", () => {
  const storage = memoryStorage();
  const now = 1_800_000_000_000;
  assert.equal(saveGuestCampaignDraft({
    title: "A campaign", summary: "A short description", story: "The full story",
    category: "environment", goal_amount: "125.50", cover_image_url: "https://example.com/image.png",
  }, { storage, now }), true);
  const draft = readGuestCampaignDraft({ storage, now: now + 1000 });
  assert.equal(draft.title, "A campaign");
  assert.equal(draft.category, "environment");
  assert.equal(draft.goal_amount, "125.50");
  assert.equal(draft.cover_image_url, "https://example.com/image.png");
  assert.equal(GUEST_CAMPAIGN_DRAFT_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(clearGuestCampaignDraft({ storage }), true);
  assert.equal(readGuestCampaignDraft({ storage, now }).title, "");
});

test("expired and malformed guest drafts are cleared instead of restored", () => {
  const storage = memoryStorage();
  const now = 1_800_000_000_000;
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({
    title: "Old", savedAt: now - GUEST_CAMPAIGN_DRAFT_TTL_MS - 1,
  }));
  assert.equal(readGuestCampaignDraft({ storage, now }).title, "");
  assert.equal(storage.has("ifund-guest-campaign-v1"), false);
  storage.setItem("ifund-guest-campaign-v1", "{broken");
  assert.equal(readGuestCampaignDraft({ storage, now }).title, "");
  assert.equal(storage.has("ifund-guest-campaign-v1"), false);
});

test("guest campaign form saves only after sign-in and preserves its return path", () => {
  const creator = read("../src/pages/CreateCampaign.jsx");
  assert.ok(creator.includes("readGuestCampaignDraft"));
  assert.ok(creator.includes("saveGuestCampaignDraft(form)"));
  assert.ok(creator.includes("clearGuestCampaignDraft()"));
  assert.ok(creator.includes('navigate("/login?returnTo="'));
});

test("signup and recovery callbacks preserve a safe campaign return destination", async () => {
  const auth = read("../src/pages/AuthPage.jsx");
  const callback = read("../src/lib/authCallback.js");
  assert.ok(auth.includes("rememberAuthReturnTo(afterLogin)"));
  assert.ok(auth.includes("authCallbackUrl(window.location.origin,{recovery:true})"));
  assert.ok(auth.includes('type:"recovery"'));
  assert.ok(auth.includes("updateUser({password:newPassword})"));
  assert.ok(auth.includes("Send another recovery email"));
  assert.ok(callback.includes("AUTH_RETURN_TO_KEY"));
  assert.ok(callback.includes("safeReturnTo(query.get(\"returnTo\") || storedReturnTo)"));

  const storage = memoryStorage();
  rememberAuthReturnTo("/create", { storage });
  const url = authCallbackUrl("https://interplanetaryfund.com", { recovery: true });
  assert.equal(new URL(url).searchParams.get("next"), "/reset-password");
  const params = callbackParameters(url + "&code=pkce", { storage });
  assert.equal(params.next, "/reset-password");
  assert.equal(params.returnTo, "/create");

  let exchanged = false;
  const destination = await completeAuthCallback({
    exchangeCodeForSession: async () => {
      exchanged = true;
      return { data: {}, error: null };
    },
    getUser: async () => ({
      data: { user: { id: "user-1", email_confirmed_at: "2026-11-09T00:00:00Z" } },
      error: null,
    }),
  }, params, { storage });
  assert.equal(exchanged, true);
  assert.equal(destination, "/reset-password?returnTo=%2Fcreate");
  assert.equal(storage.has("ifund-auth-return-to"), false);
});

test("password reset page requires a live session and preserves return destination", () => {
  const reset = read("../src/pages/ResetPassword.jsx");
  assert.ok(reset.includes("auth.getSession"));
  assert.ok(reset.includes("auth.updateUser({password})"));
  assert.ok(reset.includes("safeReturnTo"));
  assert.ok(reset.includes("returnTo="));
});

test("campaign return onboarding cannot be skipped without a usable profile", () => {
  const onboarding = read("../src/pages/Onboarding.jsx");
  assert.match(onboarding, /if\\(!name\\.trim\\(\\)&&!handle\\.trim\\(\\)\\)/);
  assert.match(onboarding, /afterLogin === "\\/dashboard" &&/);
});

test("new members finish profile onboarding before returning to a guest campaign", async () => {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email_confirmed_at: "2026-11-09T00:00:00Z" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };
  assert.equal(await landingAfterLogin(client, "/create"), "/onboarding?returnTo=%2Fcreate");
});
