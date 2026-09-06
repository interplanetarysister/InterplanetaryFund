"use node";

/*
 * Interplanetary Fund — Browserbase Social Publisher
 *
 * Runs only as an internal Node action. It connects to Browserbase over CDP
 * using persisted Contexts so authorized social logins survive across runs.
 * A browser submission is never treated as success unless a platform
 * permalink can be observed after submission.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { chromium, type Browser, type Page } from "playwright-core";

const SESSION_URL = "https://api.browserbase.com/v1/sessions";

type BrowserResult = {
  ok: boolean;
  reason?: string;
  retryable?: boolean;
  submitted?: boolean;
  externalId?: string;
  postUrl?: string;
  publisher?: string;
  sessionId?: string;
};

function contextFor(platform: string) {
  if (platform === "facebook") {
    return process.env.BROWSERBASE_FACEBOOK_CONTEXT_ID || process.env.BROWSERBASE_SOCIAL_CONTEXT_ID || "";
  }
  if (platform === "instagram") {
    return process.env.BROWSERBASE_INSTAGRAM_CONTEXT_ID || process.env.BROWSERBASE_SOCIAL_CONTEXT_ID || "";
  }
  return process.env.BROWSERBASE_SOCIAL_CONTEXT_ID || "";
}

async function createSession(platform: string) {
  const apiKey = process.env.BROWSERBASE_API_KEY || "";
  const projectId = process.env.BROWSERBASE_PROJECT_ID || "";
  const contextId = contextFor(platform);
  if (!apiKey || !projectId) {
    return { ok: false as const, reason: "browserbase_credentials_missing" };
  }
  if (!contextId) {
    return { ok: false as const, reason: `browserbase_${platform}_context_missing` };
  }

  const response = await fetch(SESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browserbase-API-Key": apiKey,
    },
    body: JSON.stringify({
      projectId,
      keepAlive: false,
      browserSettings: {
        context: { id: contextId, persist: true },
      },
    }),
  });
  if (!response.ok) {
    return { ok: false as const, reason: `browserbase_session_http_${response.status}` };
  }
  const session: any = await response.json();
  if (!session?.id || !session?.connectUrl) {
    return { ok: false as const, reason: "browserbase_session_missing_connect_url" };
  }
  return { ok: true as const, session };
}

function absoluteUrl(base: string, href: string | null) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

async function isLoginPage(page: Page, platform: string) {
  const url = page.url().toLowerCase();
  if (url.includes("/login") || url.includes("checkpoint")) return true;
  if (platform === "facebook") {
    return (await page.locator('input[name="email"], input[name="pass"]').count()) > 0;
  }
  if (platform === "instagram") {
    return (await page.locator('input[name="username"], input[name="password"]').count()) > 0;
  }
  return false;
}

async function firstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1500 })) return locator;
    } catch { /* try next selector */ }
  }
  return null;
}

async function publishFacebook(page: Page, content: string, targetUrl?: string): Promise<BrowserResult> {
  const url = targetUrl || process.env.FACEBOOK_OUTREACH_TARGET_URL || "https://www.facebook.com/";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  if (await isLoginPage(page, "facebook")) {
    return { ok: false, reason: "facebook_context_not_authenticated", retryable: false };
  }

  const composer = await firstVisible(page, [
    '[role="button"][aria-label*="Create a public post" i]',
    '[role="button"][aria-label*="Write something" i]',
    'div[role="button"]:has-text("Write something")',
    'div[role="button"]:has-text("What\'s on your mind")',
  ]);
  if (!composer) return { ok: false, reason: "facebook_composer_not_found", retryable: true };
  await composer.click();

  const editor = await firstVisible(page, [
    '[role="dialog"] [contenteditable="true"][role="textbox"]',
    '[role="dialog"] [contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ]);
  if (!editor) return { ok: false, reason: "facebook_editor_not_found", retryable: true };
  await editor.click();
  await page.keyboard.insertText(content);

  const postButton = await firstVisible(page, [
    '[role="dialog"] div[role="button"]:has-text("Post")',
    '[role="dialog"] button:has-text("Post")',
  ]);
  if (!postButton) return { ok: false, reason: "facebook_post_button_not_found", retryable: true };
  await postButton.click();
  await page.waitForTimeout(4500);

  const excerpt = content.replace(/\s+/g, " ").trim().slice(0, 48);
  const articles = page.locator('[role="article"]');
  let matching = articles.filter({ hasText: excerpt }).first();
  try {
    if (!(await matching.isVisible({ timeout: 3500 }))) matching = articles.first();
  } catch {
    matching = articles.first();
  }
  const link = matching.locator('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid="]').first();
  const href = await link.getAttribute("href").catch(() => null);
  const permalink = absoluteUrl("https://www.facebook.com", href);
  if (!permalink) {
    return { ok: false, submitted: true, retryable: false, reason: "facebook_submit_unverified" };
  }
  return {
    ok: true,
    externalId: permalink,
    postUrl: permalink,
    publisher: "browserbase_cdp_facebook",
  };
}

async function fetchImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`image_http_${response.status}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: contentType,
    name: contentType.includes("png") ? "campaign.png" : "campaign.jpg",
  };
}

async function publishInstagram(page: Page, content: string, imageUrl?: string): Promise<BrowserResult> {
  if (!imageUrl) return { ok: false, reason: "instagram_image_required", retryable: false };
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  if (await isLoginPage(page, "instagram")) {
    return { ok: false, reason: "instagram_context_not_authenticated", retryable: false };
  }

  const create = await firstVisible(page, [
    'svg[aria-label="New post"]',
    'a[href*="/create/"]',
    'div[role="button"]:has-text("Create")',
  ]);
  if (create) await create.click();

  const fileInput = page.locator('input[type="file"]').first();
  try { await fileInput.waitFor({ state: "attached", timeout: 8000 }); }
  catch { return { ok: false, reason: "instagram_file_input_not_found", retryable: true }; }

  let image;
  try { image = await fetchImage(imageUrl); }
  catch (error) { return { ok: false, reason: `instagram_image_fetch_failed:${String(error)}`, retryable: true }; }
  await fileInput.setInputFiles(image);

  for (let i = 0; i < 2; i++) {
    const next = await firstVisible(page, [
      '[role="dialog"] div[role="button"]:has-text("Next")',
      '[role="dialog"] button:has-text("Next")',
      'div[role="button"]:has-text("Next")',
    ]);
    if (next) { await next.click(); await page.waitForTimeout(1200); }
  }

  const caption = await firstVisible(page, [
    '[role="dialog"] textarea[aria-label*="caption" i]',
    '[role="dialog"] textarea',
  ]);
  if (!caption) return { ok: false, reason: "instagram_caption_not_found", retryable: true };
  await caption.fill(content.slice(0, 2200));

  const share = await firstVisible(page, [
    '[role="dialog"] div[role="button"]:has-text("Share")',
    '[role="dialog"] button:has-text("Share")',
  ]);
  if (!share) return { ok: false, reason: "instagram_share_button_not_found", retryable: true };
  await share.click();

  const confirmation = page.getByText(/your post has been shared/i).first();
  try { await confirmation.waitFor({ state: "visible", timeout: 30_000 }); }
  catch { return { ok: false, submitted: true, retryable: false, reason: "instagram_submit_unverified" }; }

  const profileUrl = process.env.INSTAGRAM_PROFILE_URL || "";
  if (!profileUrl) {
    return { ok: false, submitted: true, retryable: false, reason: "instagram_permalink_profile_url_missing" };
  }
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const postLink = page.locator('a[href^="/p/"], a[href*="instagram.com/p/"]').first();
  let href: string | null = null;
  try {
    await postLink.waitFor({ state: "visible", timeout: 10_000 });
    href = await postLink.getAttribute("href");
  } catch { /* fail closed below */ }
  const permalink = absoluteUrl("https://www.instagram.com", href);
  if (!permalink) {
    return { ok: false, submitted: true, retryable: false, reason: "instagram_permalink_unverified" };
  }
  return {
    ok: true,
    externalId: permalink,
    postUrl: permalink,
    publisher: "browserbase_cdp_instagram",
  };
}

export const healthCheck = internalAction({
  args: { platform: v.string() },
  handler: async (_ctx, { platform }) => {
    const created = await createSession(platform.toLowerCase());
    if (!created.ok) return { healthy: false, reason: created.reason };
    let browser: Browser | null = null;
    try {
      browser = await chromium.connectOverCDP(created.session.connectUrl);
      const contexts = browser.contexts();
      const page = contexts[0]?.pages()[0] || await contexts[0]?.newPage();
      if (!page) return { healthy: false, reason: "browserbase_page_missing", sessionId: created.session.id };
      const target = platform.toLowerCase() === "instagram" ? "https://www.instagram.com/" : "https://www.facebook.com/";
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const authenticated = !(await isLoginPage(page, platform.toLowerCase()));
      return {
        healthy: authenticated,
        authenticated,
        reason: authenticated ? undefined : `${platform}_context_not_authenticated`,
        sessionId: created.session.id,
      };
    } catch (error) {
      return { healthy: false, reason: String(error), sessionId: created.session.id };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  },
});

export const publish = internalAction({
  args: {
    platform: v.string(),
    content: v.string(),
    targetUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const platform = args.platform.toLowerCase();
    if (platform !== "facebook" && platform !== "instagram") {
      return { ok: false, reason: "browser_platform_unsupported", retryable: false };
    }
    const created = await createSession(platform);
    if (!created.ok) return { ok: false, reason: created.reason, retryable: false };

    let browser: Browser | null = null;
    try {
      browser = await chromium.connectOverCDP(created.session.connectUrl);
      const context = browser.contexts()[0];
      if (!context) return { ok: false, reason: "browser_context_missing", retryable: true, sessionId: created.session.id };
      const page = context.pages()[0] || await context.newPage();
      const result = platform === "facebook"
        ? await publishFacebook(page, args.content, args.targetUrl)
        : await publishInstagram(page, args.content, args.imageUrl);
      return { ...result, sessionId: created.session.id };
    } catch (error) {
      return { ok: false, reason: String(error), retryable: true, sessionId: created.session.id };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  },
});
