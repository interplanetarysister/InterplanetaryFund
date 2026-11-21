import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const headers=readFileSync(new URL("../public/_headers",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const tour=readFileSync(new URL("../public/stitch-review/index.html",import.meta.url),"utf8").replace(/\r\n/g,"\n");
test("read-only iframe can load compiled public JS without broadening access to private routes",()=>{
 assert.match(headers,/\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: \*/);
 assert.match(headers,/frame-ancestors 'self'/);
 assert.match(tour,/iframe\.sandbox="allow-scripts"/);
 assert.doesNotMatch(tour,/iframe\.sandbox="allow-scripts allow-same-origin"/);
 assert.match(tour,/pointer-events:none/);
 assert.match(tour,/form-action 'none'/);
});