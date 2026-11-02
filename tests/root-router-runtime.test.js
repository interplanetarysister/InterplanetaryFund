// Runtime coverage for the root app under react-router v7.
//
// The root app is what Cloudflare currently deploys, and react-router was
// upgraded from v6.30.4 to v7.18.5 to clear two moderate advisories (one an open
// redirect via backslash, which is the same attack class src/lib/authReturnTo.js
// defends against). `npm test` and `npm run build` both pass on a broken router,
// because neither renders a route. This suite renders real root-app components
// inside a real MemoryRouter, so a v7 incompatibility in Link, NavLink or
// useLocation fails here instead of in production.

import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { loadModule } from "./helpers/render.js";

const ID = "44444444-4444-4444-8444-444444444444";

let UI;
test.before(async () => {
  UI = await loadModule("src/components/UI.jsx");
});

const render = (element) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));

test("the router renders a Link to a real href", () => {
  // This is the assertion that fails if Link stops producing an anchor.
  const html = render(
    createElement(UI.CampaignCard, { c: { id: ID, title: "Orbital garden" } }),
  );
  assert.ok(html.includes(`href="/campaign/${ID}"`), html.slice(0, 300));
  assert.match(html, /Orbital garden/);
});

test("a published campaign is labelled Published", () => {
  const html = render(
    createElement(UI.CampaignCard, {
      c: { id: ID, title: "T", status: "active" },
    }),
  );
  assert.match(html, /Published/);
});

test("a draft campaign is labelled Draft", () => {
  const html = render(
    createElement(UI.CampaignCard, {
      c: { id: ID, title: "T", status: "draft" },
    }),
  );
  assert.match(html, /Draft/);
});

test("a campaign without a summary does not render an empty paragraph", () => {
  const html = render(
    createElement(UI.CampaignCard, { c: { id: ID, title: "T" } }),
  );
  assert.match(html, /No summary yet/);
});

test("the card escapes a title that contains markup", () => {
  // react-router does not affect escaping, but this pins that rendering a
  // hostile title through the real renderer stays inert.
  const html = render(
    createElement(UI.CampaignCard, {
      c: { id: ID, title: "<img src=x onerror=alert(1)>" },
    }),
  );
  assert.ok(!html.includes("<img src=x"), "a hostile title must be escaped");
  assert.ok(html.includes("&lt;img"), "the title should appear escaped");
});

test("useLocation resolves inside the router", () => {
  // Exercises the hook the root App itself calls at the top of its render.
  const Probe = () => {
    const { pathname } = useLocation();
    return createElement("span", null, pathname);
  };
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/campaigns"] },
      createElement(Probe),
    ),
  );
  assert.match(html, /\/campaigns/);
});
