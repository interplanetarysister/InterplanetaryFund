"use node";

/*
 * Interplanetary Fund — Browserbase Social Publisher
 *
 * Convex Node actions connect directly to Browserbase's standard Chrome
 * DevTools Protocol endpoint. This avoids bundling Playwright into Convex while
 * preserving authenticated Browserbase Contexts and fail-closed verification.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const SESSION_URL = "https://api.browserbase.com/v1/sessions";
const DEFAULT_TIMEOUT_MS = 30_000;

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

type PendingCall = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
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
  if (!apiKey || !projectId) return { ok: false as const, reason: "browserbase_credentials_missing" };
  if (!contextId) return { ok: false as const, reason: `browserbase_${platform}_context_missing` };

  const response = await fetch(SESSION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Browserbase-API-Key": apiKey },
    body: JSON.stringify({
      projectId,
      keepAlive: false,
      browserSettings: { context: { id: contextId, persist: true } },
    }),
  });
  if (!response.ok) return { ok: false as const, reason: `browserbase_session_http_${response.status}` };
  const session: any = await response.json();
  if (!session?.id || !session?.connectUrl) return { ok: false as const, reason: "browserbase_session_missing_connect_url" };
  return { ok: true as const, session };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function messageText(data: any): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data as ArrayBufferView);
  if (data && typeof data.text === "function") return await data.text();
  return String(data);
}

class CdpClient {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      void this.handleMessage(event.data);
    });
    socket.addEventListener("close", () => {
      for (const [id, item] of this.pending) {
        clearTimeout(item.timer);
        item.reject(new Error(`cdp_socket_closed:${id}`));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cdp_connect_timeout")), 15_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("cdp_connect_error")); }, { once: true });
    });
    return new CdpClient(socket);
  }

  private async handleMessage(data: any) {
    let message: any;
    try { message = JSON.parse(await messageText(data)); }
    catch { return; }
    if (!message?.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(`cdp_${message.error.code}:${message.error.message}`));
    else pending.resolve(message.result ?? {});
  }

  call(method: string, params: Record<string, any> = {}, sessionId?: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`cdp_timeout:${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const payload: any = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      try { this.socket.send(JSON.stringify(payload)); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async attachPage(): Promise<string> {
    const targets = await this.call("Target.getTargets");
    let target = (targets.targetInfos || []).find((item: any) => item.type === "page" && !String(item.url || "").startsWith("devtools://"));
    if (!target) {
      const created = await this.call("Target.createTarget", { url: "about:blank" });
      target = { targetId: created.targetId };
    }
    const attached = await this.call("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    if (!attached.sessionId) throw new Error("cdp_attach_missing_session");
    await this.call("Page.enable", {}, attached.sessionId);
    await this.call("Runtime.enable", {}, attached.sessionId);
    return attached.sessionId;
  }

  async evaluate(sessionId: string, expression: string): Promise<any> {
    const response = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }, sessionId);
    if (response.exceptionDetails) throw new Error(`cdp_evaluate_exception:${response.exceptionDetails.text || "unknown"}`);
    return response.result?.value;
  }

  async navigate(sessionId: string, url: string, timeoutMs = 45_000) {
    await this.call("Page.navigate", { url }, sessionId, timeoutMs);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const state = await this.evaluate(sessionId, "document.readyState");
        if (state === "interactive" || state === "complete") return;
      } catch { /* document may be between execution contexts */ }
      await delay(250);
    }
    throw new Error("cdp_navigation_timeout");
  }

  async clickPoint(sessionId: string, point: { x: number; y: number } | null) {
    if (!point) return false;
    await this.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y }, sessionId);
    await this.call("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 }, sessionId);
    await this.call("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 }, sessionId);
    return true;
  }

  async close() {
    try { this.socket.send(JSON.stringify({ id: this.nextId++, method: "Browser.close", params: {} })); }
    catch { /* already closed */ }
    await delay(100);
    try { this.socket.close(); } catch { /* already closed */ }
  }
}

const VISIBLE_HELPER = `
  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const point = (el) => {
    el.scrollIntoView({block:'center', inline:'center'});
    const r = el.getBoundingClientRect();
    return {x:r.left + r.width/2, y:r.top + r.height/2};
  };
`;

async function waitFor(client: CdpClient, sessionId: string, expression: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await client.evaluate(sessionId, expression)) return true; }
    catch { /* retry during DOM transitions */ }
    await delay(300);
  }
  return false;
}

async function clickByText(client: CdpClient, sessionId: string, labels: string[], selectors = "button,[role='button'],a") {
  const normalized = labels.map((label) => label.toLowerCase());
  const expression = `(() => { ${VISIBLE_HELPER}
    const labels = ${JSON.stringify(normalized)};
    const items = [...document.querySelectorAll(${JSON.stringify(selectors)})];
    const el = items.find((node) => visible(node) && labels.some((label) => {
      const aria = (node.getAttribute('aria-label') || '').toLowerCase();
      const text = (node.textContent || '').trim().toLowerCase();
      return aria.includes(label) || text === label || text.includes(label);
    }));
    return el ? point(el) : null;
  })()`;
  return await client.clickPoint(sessionId, await client.evaluate(sessionId, expression));
}

async function focusEditable(client: CdpClient, sessionId: string, selector: string) {
  const expression = `(() => { ${VISIBLE_HELPER}
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(visible);
    if (!el) return null;
    el.focus();
    return point(el);
  })()`;
  return await client.clickPoint(sessionId, await client.evaluate(sessionId, expression));
}

async function isLoginPage(client: CdpClient, sessionId: string, platform: string) {
  return Boolean(await client.evaluate(sessionId, `(() => {
    const url = location.href.toLowerCase();
    if (url.includes('/login') || url.includes('checkpoint')) return true;
    if (${JSON.stringify(platform)} === 'facebook') return !!document.querySelector('input[name="email"],input[name="pass"]');
    return !!document.querySelector('input[name="username"],input[name="password"]');
  })()`));
}

async function publishFacebook(client: CdpClient, sessionId: string, content: string, targetUrl?: string): Promise<BrowserResult> {
  const url = targetUrl || process.env.FACEBOOK_OUTREACH_TARGET_URL || "https://www.facebook.com/";
  await client.navigate(sessionId, url);
  await delay(2500);
  if (await isLoginPage(client, sessionId, "facebook")) return { ok: false, reason: "facebook_context_not_authenticated", retryable: false };

  const composerClicked = await clickByText(client, sessionId, ["create a public post", "write something", "what's on your mind"]);
  if (!composerClicked) return { ok: false, reason: "facebook_composer_not_found", retryable: true };
  await delay(1000);

  const editorFocused = await focusEditable(client, sessionId, "[role='dialog'] [contenteditable='true'][role='textbox'],[role='dialog'] [contenteditable='true'],[contenteditable='true'][role='textbox']");
  if (!editorFocused) return { ok: false, reason: "facebook_editor_not_found", retryable: true };
  await client.call("Input.insertText", { text: content }, sessionId);

  const postClicked = await clickByText(client, sessionId, ["post"], "[role='dialog'] button,[role='dialog'] [role='button']");
  if (!postClicked) return { ok: false, reason: "facebook_post_button_not_found", retryable: true };
  await delay(4500);

  const excerpt = content.replace(/\s+/g, " ").trim().slice(0, 48);
  const permalink = await client.evaluate(sessionId, `(() => {
    const excerpt = ${JSON.stringify(excerpt)}.toLowerCase();
    const articles = [...document.querySelectorAll('[role="article"]')];
    const article = articles.find((node) => (node.textContent || '').replace(/\\s+/g,' ').toLowerCase().includes(excerpt)) || articles[0];
    const link = article?.querySelector('a[href*="/posts/"],a[href*="/permalink/"],a[href*="story_fbid="]');
    return link?.href || null;
  })()`);
  if (!permalink) return { ok: false, submitted: true, retryable: false, reason: "facebook_submit_unverified" };
  return { ok: true, externalId: permalink, postUrl: permalink, publisher: "browserbase_native_cdp_facebook" };
}

async function fetchImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`image_http_${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) throw new Error("image_too_large_for_cdp_upload");
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    base64: buffer.toString("base64"),
    mimeType: contentType,
    name: contentType.includes("png") ? "campaign.png" : "campaign.jpg",
  };
}

async function injectFile(client: CdpClient, sessionId: string, image: { base64: string; mimeType: string; name: string }) {
  return Boolean(await client.evaluate(sessionId, `(async () => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return false;
    const raw = atob(${JSON.stringify(image.base64)});
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const file = new File([bytes], ${JSON.stringify(image.name)}, {type:${JSON.stringify(image.mimeType)}});
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
    return input.files?.length === 1;
  })()`));
}

async function publishInstagram(client: CdpClient, sessionId: string, content: string, imageUrl?: string): Promise<BrowserResult> {
  if (!imageUrl) return { ok: false, reason: "instagram_image_required", retryable: false };
  await client.navigate(sessionId, "https://www.instagram.com/");
  await delay(2500);
  if (await isLoginPage(client, sessionId, "instagram")) return { ok: false, reason: "instagram_context_not_authenticated", retryable: false };

  await clickByText(client, sessionId, ["new post", "create"]);
  const hasInput = await waitFor(client, sessionId, "!!document.querySelector('input[type=\"file\"]')", 8000);
  if (!hasInput) return { ok: false, reason: "instagram_file_input_not_found", retryable: true };

  let image;
  try { image = await fetchImage(imageUrl); }
  catch (error) { return { ok: false, reason: `instagram_image_fetch_failed:${String(error)}`, retryable: true }; }
  if (!await injectFile(client, sessionId, image)) return { ok: false, reason: "instagram_file_injection_failed", retryable: true };
  await delay(1600);

  for (let i = 0; i < 2; i++) {
    const clicked = await clickByText(client, sessionId, ["next"], "[role='dialog'] button,[role='dialog'] [role='button'],button,[role='button']");
    if (clicked) await delay(1200);
  }

  const captionFocused = await focusEditable(client, sessionId, "[role='dialog'] textarea[aria-label*='caption' i],[role='dialog'] textarea,textarea");
  if (!captionFocused) return { ok: false, reason: "instagram_caption_not_found", retryable: true };
  await client.call("Input.insertText", { text: content.slice(0, 2200) }, sessionId);

  const shareClicked = await clickByText(client, sessionId, ["share"], "[role='dialog'] button,[role='dialog'] [role='button'],button,[role='button']");
  if (!shareClicked) return { ok: false, reason: "instagram_share_button_not_found", retryable: true };
  const confirmed = await waitFor(client, sessionId, "document.body?.innerText?.toLowerCase().includes('your post has been shared')", 30_000);
  if (!confirmed) return { ok: false, submitted: true, retryable: false, reason: "instagram_submit_unverified" };

  const profileUrl = process.env.INSTAGRAM_PROFILE_URL || "";
  if (!profileUrl) return { ok: false, submitted: true, retryable: false, reason: "instagram_permalink_profile_url_missing" };
  await client.navigate(sessionId, profileUrl);
  const permalink = await client.evaluate(sessionId, `(() => {
    const link = document.querySelector('a[href^="/p/"],a[href*="instagram.com/p/"]');
    return link?.href || null;
  })()`);
  if (!permalink) return { ok: false, submitted: true, retryable: false, reason: "instagram_permalink_unverified" };
  return { ok: true, externalId: permalink, postUrl: permalink, publisher: "browserbase_native_cdp_instagram" };
}

async function withSession<T>(platform: string, fn: (client: CdpClient, cdpSessionId: string, browserbaseSessionId: string) => Promise<T>) {
  const created = await createSession(platform);
  if (!created.ok) return { created, value: null as T | null };
  let client: CdpClient | null = null;
  try {
    client = await CdpClient.connect(created.session.connectUrl);
    const cdpSessionId = await client.attachPage();
    const value = await fn(client, cdpSessionId, created.session.id);
    return { created, value };
  } finally {
    await client?.close().catch(() => undefined);
  }
}

export const healthCheck = internalAction({
  args: { platform: v.string() },
  handler: async (_ctx, { platform }) => {
    const normalized = platform.toLowerCase();
    try {
      const run = await withSession(normalized, async (client, sessionId, browserbaseSessionId) => {
        const target = normalized === "instagram" ? "https://www.instagram.com/" : "https://www.facebook.com/";
        await client.navigate(sessionId, target, 30_000);
        const authenticated = !(await isLoginPage(client, sessionId, normalized));
        return {
          healthy: authenticated,
          authenticated,
          reason: authenticated ? undefined : `${normalized}_context_not_authenticated`,
          sessionId: browserbaseSessionId,
        };
      });
      if (!run.created.ok) return { healthy: false, reason: run.created.reason };
      return run.value || { healthy: false, reason: "browserbase_health_missing_result", sessionId: run.created.session.id };
    } catch (error) {
      return { healthy: false, reason: String(error) };
    }
  },
});

export const publish = internalAction({
  args: { platform: v.string(), content: v.string(), targetUrl: v.optional(v.string()), imageUrl: v.optional(v.string()) },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const platform = args.platform.toLowerCase();
    if (platform !== "facebook" && platform !== "instagram") return { ok: false, reason: "browser_platform_unsupported", retryable: false };
    try {
      const run = await withSession(platform, async (client, sessionId, browserbaseSessionId) => {
        const result = platform === "facebook"
          ? await publishFacebook(client, sessionId, args.content, args.targetUrl)
          : await publishInstagram(client, sessionId, args.content, args.imageUrl);
        return { ...result, sessionId: browserbaseSessionId };
      });
      if (!run.created.ok) return { ok: false, reason: run.created.reason, retryable: false };
      return run.value || { ok: false, reason: "browserbase_publish_missing_result", retryable: true, sessionId: run.created.session.id };
    } catch (error) {
      return { ok: false, reason: String(error), retryable: true };
    }
  },
});
