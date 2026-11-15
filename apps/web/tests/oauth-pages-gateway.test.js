import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest } from "../functions/api/oauth/[[path]].js";

test("member OAuth gateway is fail-closed without server readiness", async()=>{
 const response=await onRequest({request:new Request("https://preview.example/api/oauth/status"),env:{}});
 assert.equal(response.status,503);
 assert.equal(response.headers.get("cache-control"),"no-store");
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 const result=await response.json();
 assert.match(result.error,/Provider connections are not configured/);
});
test("gateway delegates to canonical worker OAuth handler, never a second token vault",async()=>{
 const gateway=readFileSync(new URL("../functions/api/oauth/[[path]].js",import.meta.url),"utf8");
 assert.match(gateway,/import \{ routeOAuthRequest \} from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/worker\/oauth\.js"/);
 assert.doesNotMatch(gateway,/OAUTH_ENCRYPTION_KEY|SUPABASE_SECRET_KEY|clientSecret|fetch\("https:\/\/.*oauth/);
 const response=await onRequest({request:new Request("https://preview.example/api/oauth/unknown"),env:{}});
 assert.equal(response.status,404);
});
