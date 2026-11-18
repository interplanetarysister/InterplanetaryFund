import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUTH_TABS, PUBLIC_TABS, owningNavigationTab, navigationBackFallback } from "../src/lib/navigation.js";

const tabs=readFileSync(new URL("../src/components/MobileBottomNav.jsx",import.meta.url),"utf8");
const layout=readFileSync(new URL("../src/components/Layout.jsx",import.meta.url),"utf8");

test("mobile tabs prioritize accessible campaign creation and exploration",()=>{
  assert.deepEqual([...AUTH_TABS],["/","/discover","/create","/social","/profile"]);
  assert.deepEqual([...PUBLIC_TABS],[...AUTH_TABS]);
  assert.match(tabs,/to:"\/create",label:"Create"/);
  assert.match(tabs,/to:"\/discover",label:"Discover"/);
  assert.match(tabs,/to!=="\/profile"/);
  assert.match(layout,/MobileBottomNav user=\{user\}/);
});

test("nested destinations inherit a task-oriented mobile tab",()=>{
  const examples=[
    ["/","/"],["/dashboard","/"],["/discover","/discover"],
    ["/campaign/00000000-0000-4000-8000-000000000000","/discover"],
    ["/campaigns","/create"],["/campaigns/draft","/create"],
    ["/create","/create"],["/social","/social"],["/community","/social"],
    ["/giving","/profile"],["/profile","/profile"],["/agents","/profile"],
  ];
  for(const [route,want] of examples) {
    assert.equal(owningNavigationTab(route,false),want,route+" public");
    assert.equal(owningNavigationTab(route,true),want,route+" signed-in");
  }
  // Prefix matching must not accidentally treat /campaigns as /campaign.
  assert.equal(owningNavigationTab("/campaigns/your-draft"),"/create");
  assert.equal(navigationBackFallback("/campaign/example",false),"/discover");
  assert.equal(navigationBackFallback("/unknown",false),"/");
});
