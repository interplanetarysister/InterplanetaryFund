import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:4181";
const server = spawn("./node_modules/.bin/vite",
  ["preview", "--host", "127.0.0.1", "--port", "4181", "--strictPort"],
  { cwd: process.cwd(), stdio: "ignore" });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error("Preview server exited");
    try { ready = (await fetch(origin + "/help")).ok; if (ready) break; } catch {}
    await wait(200);
  }
  assert.ok(ready, "Vite preview must serve /help");

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const result = await page.goto(origin + "/help", { waitUntil: "domcontentloaded" });
    assert.equal(result.status(), 200);
    await page.getByRole("heading", { name: "How can we help?" }).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole("button", { name: "I Agree — Continue" }).count(), 0,
      "Public help must not require accepting account permissions");
    assert.equal(await page.getByRole("button", { name: /Getting Started/ }).count(), 1);
    await page.getByRole("button", { name: /Connections & Publishing/ }).click();
    assert.match(page.url(), /category=Connections/);
    const input = page.getByRole("textbox", { name: "Search IFund help articles" });
    await input.fill("my campaign");
    // React Router updates the address bar asynchronously after the input event.
    await page.waitForURL((url) => url.searchParams.get("q") === "my campaign", { timeout: 7000 });
    assert.match(page.url(), /q=my/);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, "Help has horizontal overflow at width " + width + ": " + overflow);
    assert.deepEqual(errors, [], "Help page threw JS exception");
    console.log("PASS Help Center visitor route " + width + "px, search, topic links, no overflow");
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(origin + "/help/an-unpublished-guide", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Back to Help Center" }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByRole("button", { name: "I Agree — Continue" }).count(), 0);
  console.log("PASS guest deep-link article page");
  await page.goto(origin + "/admin/help", { waitUntil: "domcontentloaded" });
  await wait(2500);
  assert.equal(await page.getByRole("heading", { name: "Help Center Editor" }).count(), 0,
    "Unauthenticated users cannot mount admin help editor");
  console.log("PASS unauthenticated admin editor is not mounted");
  await context.close();
} finally {
  await browser?.close();
  server.kill();
  await wait(200);
}
