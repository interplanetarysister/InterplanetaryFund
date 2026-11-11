import assert from "node:assert/strict";
import test from "node:test";
import { drivePickerConfigured, fetchDriveImage } from "../src/lib/googleDrivePicker.js";

test("Drive import is hidden until public Picker configuration exists", () => {
  assert.equal(drivePickerConfigured, false);
});

test("Drive fetch requests only the selected file with scoped authorization", async () => {
  const file = await fetchDriveImage("test-access", "picked_id", 10, undefined, async (url, options) => {
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(url.pathname, "/drive/v3/files/picked_id");
    assert.equal(url.searchParams.get("alt"), "media");
    assert.equal(options.headers.Authorization, "Bearer test-access");
    assert.equal(options.redirect, "error");
    return new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "image/png" } });
  });
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 2);
});

test("Drive fetch rejects malformed IDs, unsupported file types and oversized streams", async () => {
  await assert.rejects(fetchDriveImage("token", "../other", 5, undefined, () => {
    assert.fail("must not fetch");
  }), /invalid file/);
  await assert.rejects(fetchDriveImage("token", "selected", 5, undefined, async () =>
    new Response("file", { headers: { "Content-Type": "image/svg+xml" } })), /JPEG, PNG, or WebP/);
  await assert.rejects(fetchDriveImage("token", "selected", 5, undefined, async () =>
    new Response("larger", { headers: { "Content-Type": "image/webp" } })), /Choose an image up to/);
});
