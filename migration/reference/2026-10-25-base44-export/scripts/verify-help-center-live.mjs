import { chromium } from "playwright";
const urls = [
  "https://interplanetaryfund.com/help",
  "https://interplanetary-fund2.interplanetary-fund.workers.dev/help",
];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(4500);
      const headings = await page.locator("h1").allTextContents();
      const newSearch = await page.getByRole("textbox", { name: "Search IFund help articles" }).count();
      const legacy = await page.getByRole("heading", { name: "Help Center", exact: true }).count();
      const permissions = await page.getByRole("button", { name: "I Agree — Continue" }).count();
      console.log(JSON.stringify({ url, status: res?.status(), headings, newSearch: Boolean(newSearch), legacy: Boolean(legacy), permissions: Boolean(permissions) }));
    } catch (err) {
      console.log(JSON.stringify({ url, error: String(err.message).slice(0, 220) }));
    }
    await page.close();
  }
} finally {
  await browser.close();
}
