import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webRoot = new URL("../", import.meta.url);

test("landing page links guests and signed-in visitors to existing installer", async () => {
  const [home, app, download] = await Promise.all([
    readFile(new URL("src/pages/Home.jsx", webRoot), "utf8"),
    readFile(new URL("src/App.jsx", webRoot), "utf8"),
    readFile(new URL("src/pages/DownloadApp.jsx", webRoot), "utf8"),
  ]);
  assert.match(home, /<Link to="\/download"/);
  assert.match(home, /Get the IFund app/);
  assert.match(home, /Install the web app on iPhone, Android, or desktop/);
  assert.match(app, /path="\/download" element=\{<DownloadApp \/>\}/);
  assert.match(download, /beforeinstallprompt/);
  assert.match(download, /Add to Home Screen/);
  assert.doesNotMatch(home, /play\.google\.com|apps\.apple\.com/);
});
