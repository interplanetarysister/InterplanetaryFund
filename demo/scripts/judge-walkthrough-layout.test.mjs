import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judgeTourClient } from "../worker/judge-tour-client.js";
import { judgeTourStyles } from "../worker/judge-tour-style.js";

const client = readFileSync(new URL("../worker/judge-tour-client.js", import.meta.url), "utf8");
const backend = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
const helpers = client.slice(client.indexOf("  function intersects("), client.indexOf("  function position()"));
assert.ok(helpers.includes("function safePosition("), "safe geometry helper exists");
const { safePosition, intersects } = new Function(helpers + "\nreturn {safePosition,intersects};")();

function check(label, spotlight, card, viewport) {
  const found = safePosition(spotlight, card.width, card.height, viewport.width, viewport.height);
  assert.ok(found, label + ": must fit a visible instruction card");
  const area = {left:found.left, top:found.top, right:found.left+card.width, bottom:found.top+card.height};
  assert.equal(intersects(area, spotlight, 10), false, label + ": highlighted item never covered");
  assert.ok(area.left >= 14 && area.top >= 14, label + ": safe-area edge");
  assert.ok(area.right <= viewport.width - 14 && area.bottom <= viewport.height - 14, label + ": card within viewport");
}

test("judge guide script parses and never calls payment APIs", () => {
  assert.equal(typeof judgeTourClient, "function");
  assert.doesNotMatch(client, /fetch\(\s*["']\/api\/(?:paypal|donations|ai)/);
  assert.doesNotMatch(client, /\.submit\(\)|\.requestPayment\(/);
  assert.match(client, /No real payment is made/);
});

test("desktop card docks beside spotlight without intersection", () => {
  check("desktop-right", {left:25,top:145,right:235,bottom:193},
    {width:340,height:245}, {width:1440,height:900});
  check("desktop-left", {left:1170,top:140,right:1380,bottom:185},
    {width:340,height:245}, {width:1440,height:900});
});

test("mobile card chooses above or below, never over the highlighted target", () => {
  check("mobile-bottom", {left:110,top:160,right:270,bottom:208},
    {width:340,height:208}, {width:390,height:844});
  check("mobile-top", {left:40,top:685,right:340,bottom:728},
    {width:340,height:208}, {width:390,height:844});
});

test("oversized target minimizes the guide instead of covering a control", () => {
  assert.equal(safePosition({left:0,top:0,right:360,bottom:720},
    330,220,360,720), null);
  assert.match(client, /if \(!candidate\)/);
  assert.match(client, /panel\.hidden = true;\s*spotlight\.hidden = true;/);
  assert.match(client, /launcher\.textContent = "✦ Guide "/);
});

test("styles are isolated, mobile safe, and target remains clickable", () => {
  assert.match(judgeTourStyles, /#ifund-judge-guide/);
  assert.match(judgeTourStyles, /#ifund-judge-spotlight/);
  assert.match(judgeTourStyles, /pointer-events:\s*none\s*!important/);
  assert.match(judgeTourStyles, /env\(safe-area-inset-bottom\)/);
  assert.match(judgeTourStyles, /prefers-reduced-motion/);
  assert.match(judgeTourStyles, /@media \(max-width: 480px\)/);
});

test("demo Worker injects guide only for HTML documents, not API or embeds", () => {
  assert.match(backend, /if \(!path\.startsWith\("\/api\/"\)\)/);
  assert.match(backend, /path === GUIDE_SCRIPT_PATH/);
  assert.match(backend, /path === GUIDE_STYLE_PATH/);
  assert.match(backend, /res\.headers\.get\("content-type"\)\?\.includes\("text\/html"\)/);
  assert.match(backend, /!path\.startsWith\("\/embed\/"\)/);
  assert.match(backend, /html\.replace\("<\/head>", tags \+ "<\/head>"\)/);
  assert.match(backend, /return new Response\(res\.body, \{ status: res\.status, headers \}\)/);
});

test("walkthrough uses actual sandbox routes without claiming fabricated payment success", () => {
  for (const route of ["/hackathon","/create","/discover","/campaign/","/checkout","/dashboard","/map"])
    assert.ok(client.includes('path: "' + route + '"'), route + " is covered");
  assert.match(client, /A real PayPal sandbox capture, not approval alone, creates a receipt/);
  assert.match(client, /no payment will be initiated automatically/i);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /getBoundingClientRect/);
});
