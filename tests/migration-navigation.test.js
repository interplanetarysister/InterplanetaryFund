import test from "node:test";
import assert from "node:assert/strict";
import {
  publicNavigation, memberNavigation, adminNavigation,
  navigationFor, readyRoutes, isNavigationReady,
} from "../src/lib/migrationNavigation.js";

test("guests cannot see private or administrative destinations", () => {
  const sections = navigationFor();
  assert.deepEqual(sections.map(s => s.label), ["Explore"]);
  assert.equal(sections[0].items, publicNavigation);
  assert.ok(!sections.flatMap(s => s.items).some(i => i.path === "/withdrawals"));
});

test("members see source hierarchy but not administration", () => {
  const sections = navigationFor({ signedIn: true, role: "member" });
  assert.deepEqual(sections.map(s => s.label), memberNavigation.map(s => s.label));
  assert.ok(!sections.includes(adminNavigation));
});

test("admins have administrative menu without enabling unsupported APIs", () => {
  const sections = navigationFor({ signedIn: true, role: "super_admin" });
  assert.equal(sections.at(-1), adminNavigation);
  assert.ok(adminNavigation.items.every(i => !isNavigationReady(i)));
});

test("only implemented routes can be rendered as links", () => {
  const all = [...publicNavigation, ...memberNavigation.flatMap(s => s.items), ...adminNavigation.items];
  for (const item of all) {
    if (isNavigationReady(item)) {
      assert.equal(item.ready, true);
      assert.equal(readyRoutes.has(item.path), true);
    }
    if (!readyRoutes.has(item.path)) assert.equal(isNavigationReady(item), false);
  }
  assert.equal(isNavigationReady({ label: "Pretend payout", path: "/withdrawals", ready: true }), false);
});

test("guest-ready destinations match the independent scaffold", () => {
  assert.deepEqual(
    publicNavigation.filter(isNavigationReady).map(i => i.path),
    ["/", "/discover", "/community"]
  );
  const current = memberNavigation.flatMap(s => s.items).filter(isNavigationReady).map(i => i.path);
  for (const path of ["/discover", "/create", "/mine", "/community", "/login", "/connections"])
    assert.ok(current.includes(path), path);
});
