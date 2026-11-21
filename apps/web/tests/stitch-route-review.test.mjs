import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../public/stitch-review/index.html");
const app=read("../src/App.jsx");
const raw=page.match(/const ROUTES=(\[[^\n]+\]);/);
assert.ok(raw,"Route inventory must be embedded as public static data");
const listed=JSON.parse(raw[1]);
const actual=[...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^\n]+?)(?=\s*\/>)/g)]
 .map(m=>m[1]).filter(path=>path!=="*"&&path!=="/admin/*");

test("Stitch tour shows exactly the existing source routes, not invented pages",()=>{
 assert.deepEqual([...new Set(listed.map(x=>x.path))].sort(),actual.sort());
 assert.ok(listed.length>=95);
 assert.ok(listed.some(x=>x.access==="Super-admin"));
 assert.ok(listed.every(x=>x.label&&x.group));
});

test("third-party Stitch sees no owner, finance, or admin content",()=>{
 assert.match(page,/iframe\.sandbox="allow-scripts"/);
 assert.doesNotMatch(page,/iframe\.sandbox="[^"]*(?:allow-same-origin|allow-forms|allow-top-navigation|allow-popups)/);
 assert.match(page,/item\.access!=="Public"\|\|item\.dynamic\|\|item\.redirected/);
 assert.match(page,/pointer-events:none/);
 assert.match(page,/form-action 'none'/);
 assert.match(page,/connect-src 'none'/);
 assert.match(page,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(page,/Bearer |service_role|SUPABASE_SERVICE|password\s*:/i);
});

test("navigating the route list cannot escape the verified inventory",()=>{
 assert.match(page,/function safeChoice\(path\)\{return lookup\.has\(path\)\?path:"\/";\}/);
 assert.match(page,/renderNav\(\);select\(selected\);/);
 assert.match(page,/setAttribute\("aria-current"/);
 assert.match(page,/id="mobile"/);
 assert.match(page,/id="desktop"/);
});
