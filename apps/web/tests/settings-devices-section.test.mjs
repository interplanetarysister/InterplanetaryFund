import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 8 (2026-11-25): Settings gains a "devices" section on the unified
// permissions hub (/permissions?section=devices) that reuses the existing
// Devices page component. The parent redirects /devices to that section in
// App.jsx; this file owns only the section itself. /connections keeps
// rendering the same component with the platforms section open.

const EXISTING_SECTIONS = [
  ["ai", "AI Assistance", "AIPermissionPreferences"],
  ["platforms", "Connected platforms", "Connections"],
  ["marketing", "Optional marketing", "MarketingPreferences"],
  ["supporter-updates", "Supporter updates", "CommunicationPreferences"],
  ["documents", "Campaign documents", "CampaignDocumentPermissions"],
];

test("?section=devices renders the existing Devices component", () => {
  const hub = read("src/pages/ManagePermissions.jsx");
  assert.match(hub, /import Devices from "\.\/Devices"/);
  assert.match(hub, /\["devices","Devices"\]/);
  assert.match(hub, /\{open==="devices" && <Devices\/>\}/);
  assert.match(
    hub,
    /\["ai","platforms","marketing","supporter-updates","documents","devices"\]\.includes\(requestedSection\)/,
  );
  // Devices takes no props and verifies the session itself via authClient,
  // so the section passes nothing and adds no gating: both /permissions
  // and /devices are already Member-gated in App.jsx.
  assert.doesNotMatch(hub, /<Devices [^/]*\w+=/);
  const devices = read("src/pages/Devices.jsx");
  assert.match(devices, /export default function Devices\(\)/);
  assert.match(devices, /Connected devices and sessions/);
  assert.match(devices, /authClient\(\)/);
  // The no-props shape is pinned by the `Devices()` signature above:
  // `signOut({ scope })` passes an object to Supabase, not props.
});

test("existing sections still render with their buttons and components", () => {
  const hub = read("src/pages/ManagePermissions.jsx");
  for (const [id, label, component] of EXISTING_SECTIONS) {
    assert.ok(
      hub.includes(`["${id}","${label}"]`),
      `missing section button ${id}`,
    );
    assert.ok(
      hub.includes(`open==="${id}"`),
      `missing render conditional for ${id}`,
    );
    assert.ok(
      hub.includes(`<${component}`),
      `missing ${component} render for ${id}`,
    );
  }
  // Section buttons keep the existing pattern: one map over [id, label]
  // pairs, aria-pressed, min-h-11 touch target.
  assert.match(hub, /role="group" aria-label="Permission categories"/);
  assert.match(hub, /aria-pressed=\{open===id\}/);
  assert.match(hub, /min-h-11 rounded-xl border px-4 font-semibold/);
});

test("default section is unchanged and unknown sections fall back to it", () => {
  const hub = read("src/pages/ManagePermissions.jsx");
  // No section (or an unknown one) opens AI Assistance, as before.
  assert.match(
    hub,
    /\.includes\(requestedSection\)\?requestedSection:"ai"/,
  );
  assert.doesNotMatch(hub, /requestedSection:"devices"/);
  assert.doesNotMatch(hub, /requestedSection:"platforms"/);
  // /connections still forces the platforms section regardless of ?section=.
  assert.match(
    hub,
    /location\.pathname === "\/connections" \? "platforms"/,
  );
  const app = read("src/App.jsx");
  assert.match(
    app,
    /path="\/connections" element=\{<MemberAccess><ManagePermissions \/><\/MemberAccess>\}/,
  );
  assert.match(
    app,
    /path="\/permissions" element=\{<MemberAccess><ManagePermissions \/><\/MemberAccess>\}/,
  );
});

test("devices section uses the ?section= convention and adds no second surface", () => {
  const hub = read("src/pages/ManagePermissions.jsx");
  assert.match(hub, /get\("section"\)/);
  assert.doesNotMatch(hub, /get\("tab"\)/);
  // No MemberAccess or other gating inside the hub: App.jsx owns it.
  assert.doesNotMatch(hub, /MemberAccess|RequireAuth|Navigate/);
  // No duplicate Devices page or second permissions component is created.
  assert.doesNotMatch(hub, /import .* from "\.\/Devices\.jsx"|DevicesPage|DevicesSection/);
  assert.doesNotMatch(hub, /<Devices\/>.*<Devices\/>/s);
});
