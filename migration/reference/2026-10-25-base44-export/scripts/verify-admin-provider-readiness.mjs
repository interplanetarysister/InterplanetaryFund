import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const backend = read("base44/functions/adminOAuthProviderReadiness/entry.ts");
const registry = read("base44/shared/connectionVerification.ts");
const frontend = read("src/components/connections/AdminOAuthProviderReadiness.jsx");
const page = read("src/pages/Connections.jsx");
const adminPage = read("src/pages/IntegrationsAdmin.jsx");

const unique = [...new Set([...registry.matchAll(/^\s*[a-z_]+:\s*'(APP_USER_CONNECTOR_[A-Z_]+)'/gm)].map(x => x[1]))];
// Use the canonical registry, not a stale hard-coded provider count: WordPress
// and future explicitly registered connectors must appear in this same audit.
assert.ok(unique.length >= 25, "Audit must preserve the existing OAuth connector registrations");
assert.ok(unique.includes('APP_USER_CONNECTOR_WORDPRESS_COM_ID'), "Audit must include registered WordPress connector");
assert.ok(unique.includes('APP_USER_CONNECTOR_ONE_DRIVE_ID'), "Audit must include OneDrive app-user connector registration");
const catalog = read("src/components/connections/platformCatalog.js");
const verifier = read("base44/shared/connectionVerification.ts");
const oauthFinalize = read("base44/functions/finalizeAppUserOAuthConnection/entry.ts");
assert.match(catalog, /id: "wordpress_com"/, "WordPress must be an available IFund destination");
assert.match(oauthFinalize, /wordpress_com: \{ kind: 'social'/, "WordPress OAuth return must be recognized");
assert.match(verifier, /graph\.microsoft\.com\/v1\.0\/me\/drive\/root/, "OneDrive must prove file access, not just Microsoft login");
assert.match(verifier, /drive_access_verified: true/, "OneDrive identity and storage checks must stay distinct");
assert.match(verifier, /wordpress\.com\/rest\/v1\.1\/me/, "WordPress must have a provider-backed identity check");
assert.match(backend, /assertActiveAccount\(base44\)/, "Admin audit must enforce active account");
assert.match(backend, /guard\.user\?\.role !== 'admin'/, "Only IFund admins may read configuration names");
assert.match(backend, /Object\.entries\(OAUTH_ENV\)/, "Use one canonical OAuth registry");
assert.match(backend, /registration_reference_present/, "Present is only a reference, not a verified connection");
assert.doesNotMatch(backend, /connector_id:|accessToken:|secret_value:/, "Never return connector credentials or provider access tokens");
assert.doesNotMatch(page, /<AdminOAuthProviderReadiness/, "Technical configuration must never clutter normal Connections, including for IFund administrators");
assert.match(adminPage, /<AdminOAuthProviderReadiness/, "Technical configuration belongs on the admin integrations page");
assert.match(frontend, /Needs registration/, "Show setup blockers rather than claiming success");
assert.match(frontend, /Reference present; unverified/, "A registration must never be described as connected");
console.log(`PASS: ${unique.length}-provider admin configuration audit and user-account boundary.`);
