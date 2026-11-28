import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webRoot = new URL("../", import.meta.url);

// The /download install button used to render only after the browser fired
// beforeinstallprompt, which Safari never fires and Chrome/Edge often do
// not — so most visitors saw no button at all. It must always be visible
// when the app is not installed, and fall back to the per-device steps.
test("download page always shows an install button, with a guided fallback", async () => {
  const download = await readFile(new URL("src/pages/DownloadApp.jsx", webRoot), "utf8");

  // The button is not gated on the deferred prompt.
  assert.doesNotMatch(download, /installPrompt \? \(/);
  assert.match(download, /<button type="button" onClick=\{requestInstall\}/);
  assert.match(download, /Install IFund/);

  // The deferred prompt path is kept when the browser offers one.
  assert.match(download, /beforeinstallprompt/);
  assert.match(download, /await installPrompt\.prompt\(\)/);

  // Without a prompt, the tap explains the manual steps instead of doing
  // nothing, tailored to iOS, and scrolls to the instructions.
  assert.match(download, /iphone\|ipad\|ipod/i);
  assert.match(download, /Add to Home Screen — the steps are below/);
  assert.match(download, /use its menu to install IFund\. The steps for your device are below/);
  assert.match(download, /instructionsRef\.current\?\.scrollIntoView/);
  assert.match(download, /<div ref=\{instructionsRef\}/);

  // Installed state still replaces the button with a status line.
  assert.match(download, /IFund is already installed on this device\./);
});
