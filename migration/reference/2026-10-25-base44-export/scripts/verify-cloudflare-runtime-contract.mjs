import assert from "node:assert/strict"; import fs from "node:fs";
assert.equal(fs.existsSync("wrangler.jsonc"), false, "wrangler.jsonc must not coexist with canonical wrangler.toml; duplicate Wrangler configs can select a static-only deployment");
const wrangler=fs.readFileSync("wrangler.toml","utf8"); const worker=fs.readFileSync("host/gateway/worker.js","utf8"); const workflow=fs.readFileSync(".github/workflows/deploy-cloudflare.yml","utf8"); const manifest=JSON.parse(fs.readFileSync("public/manifest.json","utf8"));
assert.match(wrangler,/^name\s*=\s*"interplanetary-fund2"\s*$/m); assert.match(wrangler,/main\s*=\s*"host\/gateway\/worker\.js"/); assert.match(wrangler,/directory\s*=\s*"\.\/dist"/); assert.match(wrangler,/binding\s*=\s*"ASSETS"/); assert.match(wrangler,/not_found_handling\s*=\s*"single-page-application"/);
assert.match(wrangler,/IFUND_BASE44_ORIGIN\s*=\s*"https:\/\/interplanetaryfund\.base44\.app"/);
for (const route of ["/v1/admin/agents/*","/api/health","/api/health/*","/api/mcp","/api/mcp/*","/api/apps/*/mcp","/api/apps/*/mcp/*","/.well-known/oauth-*","/.well-known/openid-configuration"]) assert.ok(wrangler.includes(`"${route}"`), `Cloudflare must run Worker compute first for ${route}`);
assert.match(wrangler,/workers_dev\s*=\s*true/);
assert.ok(wrangler.includes("keep_vars = true"), "Cloudflare must retain existing dashboard admin backend settings");
const publicOrigins = [
  "https://interplanetaryfund.com",
  "https://www.interplanetaryfund.com",
  "https://interplanetaryfund.base44.app",
  "https://interplanetary-fund2.interplanetary-fund.workers.dev",
];
for (const origin of publicOrigins) assert.ok(wrangler.includes(origin),
  `Worker must allow known authenticated IFund browser origin ${origin}`);
for (const route of [
  "interplanetaryfund.com/api/health*",
  "interplanetaryfund.com/api/mcp*",
  "interplanetaryfund.com/v1/admin/agents/*",
  "interplanetaryfund.com/.well-known/oauth-*",
  "interplanetaryfund.com/.well-known/openid-configuration*",
  "www.interplanetaryfund.com/api/health*",
  "www.interplanetaryfund.com/api/mcp*",
  "www.interplanetaryfund.com/v1/admin/agents/*",
  "www.interplanetaryfund.com/.well-known/oauth-*",
  "www.interplanetaryfund.com/.well-known/openid-configuration*",
]) {
  assert.ok(wrangler.includes(`pattern = "${route}"`), `production custom-domain Worker route missing for ${route}`);
}
assert.match(wrangler,/zone_name\s*=\s*"interplanetaryfund\.com"/);
assert.match(worker,/DEFAULT_BASE44_ORIGIN\s*=\s*"https:\/\/interplanetaryfund\.base44\.app"/);
assert.match(worker,/isMcpProxyPath/); assert.match(worker,/proxyBase44Mcp/); assert.match(worker,/x-ifund-mcp-proxy/);
assert.match(worker,/\/api\/health/); assert.match(worker,/runtime:"cloudflare-worker"/); assert.match(worker,/\/api\/mcp/); assert.match(worker,/oauth-protected-resource/); assert.match(worker,/\/v1\/admin\/agents\/session/); assert.match(worker,/\/v1\/admin\/agents\/message/);
assert.match(workflow,/npx --yes wrangler@4 deploy/); assert.match(workflow,/CLOUDFLARE_ACCESS_TOKEN/); assert.match(workflow,/deployment_url/); assert.match(workflow,/curl --fail/);
assert.match(workflow,/x-ifund-mcp-proxy/, "Cloudflare deploy verification must prove MCP requests reached Worker compute");
assert.match(workflow,/verify-live-cloudflare-pathway\.mjs/, "Release must check public-domain and Worker admin CORS behavior");
assert.match(workflow,/MCP_STATUS/, "Cloudflare deploy verification must exercise the MCP endpoint");
assert.match(workflow, /environment:\s*production_if2/, "Cloudflare deployment must use the environment that owns production credentials");
assert.match(workflow, /6a67a778342a8fe05ee79cba/, "Cloudflare build must retain the canonical Base44 app id fallback");
assert.match(workflow, /https:\/\/interplanetaryfund\.base44\.app/, "Cloudflare build must retain the canonical Base44 backend fallback");
assert.match(workflow, /test -n "\$VITE_BASE44_APP_BASE_URL"/, "Cloudflare build must fail closed without a Base44 backend URL");
assert.equal(manifest.name, "Interplanetary Fund");
assert.equal(manifest.short_name, "IFund");
assert.equal(manifest.id, "/");
assert.equal(manifest.scope, "/");
console.log("Cloudflare SPA, MCP proxy, compute runtime, PWA identity, and deployment contract passed.");
