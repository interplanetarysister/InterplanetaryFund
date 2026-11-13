/**
 * Fail before npm install/build/deploy if any linked route is still routed to
 * a branded placeholder or if a navigation item has no explicit route.
 * This is a necessary source gate, not proof of E2E readiness or provider safety.
 */
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const unfinished = [];
for (const key of ["STANDALONE_COMING_SOON", "LAYOUT_COMING_SOON"]) {
  const block = app.match(new RegExp("const\\s+" + key + "\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;"));
  if (!block) {
    unfinished.push("Missing verified " + key + " inventory");
    continue;
  }
  for (const match of block[1].matchAll(/["'](\/[^"']+)["']/g)) {
    unfinished.push("Unimplemented route: " + match[1]);
  }
}
if (/const\s+ComingSoon\s*=|element=\{<ComingSoon\s*\/>\}/.test(app)) {
  unfinished.push("ComingSoon route component still referenced");
}
const declaredRoutes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(row => row[1]));
const navigation = new Set([...layout.matchAll(/\{\s*to:\s*"(\/[^"]+)"/g)].map(row => row[1]));
for (const path of navigation) {
  if (!declaredRoutes.has(path)) {
    unfinished.push("Navigation has no explicit route: " + path);
  }
}
// All explicit routes and mapped legacy routes must have individual source
// and negative-case evidence before the one consolidated preview build.
const acceptanceRoutes = new Set(declaredRoutes);
for (const key of ["STANDALONE_COMING_SOON", "LAYOUT_COMING_SOON"]) {
  const block = app.match(new RegExp("const\\\\s+" + key + "\\\\s*=\\\\s*\\\\[([\\\\s\\\\S]*?)\\\\]\\\\s*;"));
  if (block) for (const matched of block[1].matchAll(/["'](\\/[^"']+)["']/g)) acceptanceRoutes.add(matched[1]);
}
try {
  const register = JSON.parse(read("ci/route-acceptance.json"));
  if (register.schema_version !== 1 || !Array.isArray(register.routes))
    throw Error("Unsupported or missing route inventory schema");
  const byRoute = new Map();
  for (const entry of register.routes) {
    if (!entry || typeof entry.route !== "string" || byRoute.has(entry.route)) {
      unfinished.push("Duplicate or invalid route acceptance row");
      continue;
    }
    byRoute.set(entry.route, entry);
    if (!acceptanceRoutes.has(entry.route))
      unfinished.push("Stale acceptance route: " + entry.route);
    if (entry.source_status !== "source_ready" ||
        typeof entry.source_evidence !== "string" || !entry.source_evidence.trim() ||
        typeof entry.behavior_evidence !== "string" || !entry.behavior_evidence.trim())
      unfinished.push("Missing source and test acceptance: " + entry.route);
  }
  for (const route of acceptanceRoutes)
    if (!byRoute.has(route)) unfinished.push("Untracked source route: " + route);
} catch (error) {
  unfinished.push("Route acceptance manifest unreadable: " + error.message);
}
if (unfinished.length) {
  process.stderr.write("IFund release gate: route completion is NOT certified.\n" +
    unfinished.map(item => " - " + item).join("\n") + "\n" +
    "Do not compile or publish preview/production. Finish routes, then run negative-case and browser E2E checks.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Static route completeness checked. Still required: RLS, provider, functional and browser acceptance before preview.\n"
  );
}
