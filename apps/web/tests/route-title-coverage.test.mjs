import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pageTitle,browserPageTitle} from "../src/lib/routeTitles.mjs";
const manifest=JSON.parse(readFileSync(new URL("../ci/route-acceptance.json",import.meta.url),"utf8")).routes;

test("all 88 registered routes have explicit meaningful titles",()=>{
  const missing=[];
  for(const route of manifest){
    const path=route.route==="*" ? "/not-a-real-page" :
      route.route.includes("*")?"/admin/not-a-real-page":
      route.route.replace(/:([\w]+)/g,"sample");
    if(pageTitle(path)==="Page Not Found"&&route.route!=="*")missing.push(route.route);
  }
  assert.deepEqual(missing,[]);
  assert.equal(pageTitle("/"),"Home");
  assert.equal(pageTitle("/campaigns/123/edit"),"Edit Campaign");
  assert.equal(pageTitle("/admin/audit"),"Audit Log");
  assert.equal(pageTitle("/social/post/123"),"Social Post");
});

test("browser page identities respect home branding without exposing resource tokens",()=>{
  assert.equal(browserPageTitle("/"),"Interplanetary Fund — What If?");
  assert.equal(browserPageTitle("/discover"),"Discover Campaigns | Interplanetary Fund");
  assert.equal(browserPageTitle("/campaign/some-private-uuid"),"Campaign | Interplanetary Fund");
  assert.equal(browserPageTitle("/admin/deletions"),"Account Deletion Requests | Interplanetary Fund");
  assert.equal(browserPageTitle("/unknown"),"Page Not Found | Interplanetary Fund");
});

test("browser and workspace identity share the same canonical source",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const layout=readFileSync(new URL("../src/components/Layout.jsx",import.meta.url),"utf8");
  assert.match(app,/document\.title = browserPageTitle\(pathname\)/);
  assert.match(app,/<RouteTitleSync \/>/);
  assert.match(layout,/import \{ pageTitle \} from "@\/lib\/routeTitles\.mjs"/);
});
