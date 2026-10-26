import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("source-derived IFund logo is present and its binary Git SHA matches", () => {
  const file = readFileSync(new URL("../public/ifund-logo-small.webp", import.meta.url));
  assert.equal(file.length, 636);
  const sha = createHash("sha1").update("blob " + file.length + "\0").update(file).digest("hex");
  assert.equal(sha, "4258c5409b39e248c4396219d24de29ca686a4bb");
  const component = readFileSync(new URL("../src/components/UI.jsx", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(component.includes('/ifund-logo-small.webp'));
  assert.ok(html.includes('/ifund-logo-small.webp'));
});
