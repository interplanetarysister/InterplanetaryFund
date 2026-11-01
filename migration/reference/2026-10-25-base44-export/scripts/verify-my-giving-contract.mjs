import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../src/pages/MyGiving.jsx", import.meta.url), "utf8");
assert.match(s, /Array\.isArray\(data\.donations\)/);
assert.match(s, /Number\.isFinite\(Number\(row\.amount\)\)/);
assert.doesNotMatch(s, /setError\(e\.message|setError\(e\?\.message/);
assert.match(s, /We couldn't load your giving history\. Please try again\./);
console.log("My Giving response safety contract verified.");
