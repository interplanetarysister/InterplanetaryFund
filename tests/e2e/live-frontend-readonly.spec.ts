/**
 * Live IFund frontend: safe, read-only browser checks.
 * Never sign in, click submit, create accounts, or send payments.
 */
import { test, expect } from '@playwright/test';

const SITE_URL = process.env.LIVE_SITE_URL || 'https://interplanetaryfund.com/';

async function inspectPage(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(SITE_URL, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  expect(response, 'homepage must return a document response').not.toBeNull();
  expect(response!.status(), 'homepage HTTP status').toBeLessThan(400);
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(async () =>
    (await page.locator('body').innerText()).trim().length,
    { timeout: 20000, message: 'homepage should render meaningful readable text' }
  ).toBeGreaterThan(40);
  expect((await page.title()).trim().length, 'document title').toBeGreaterThan(0);
  expect(errors, 'unhandled browser JavaScript errors').toEqual([]);
}

test('published homepage loads meaningful content without fatal errors', async ({ page }) => {
  await inspectPage(page);
});

test('published homepage fits a mobile viewport without horizontal clipping', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  try {
    const page = await context.newPage();
    await inspectPage(page);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content, 'mobile page must fit the screen width')
      .toBeLessThanOrEqual(dimensions.viewport + 12);
  } finally {
    await context.close();
  }
});
