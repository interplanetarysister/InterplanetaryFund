import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 8 (2026-11-25): single tabbed Help Center page (40-page list).
// /help is public and carries ?tab=help|tickets (default help, unknown
// falls back to help). The help tab is the entire pre-existing Help
// content, including ?q= and ?category= filters. The tickets tab reuses
// the existing SupportTickets page, but only for signed-in members:
// signed-out visitors get a sign-in card instead, because /support was
// Member-gated while /help is public. /support itself redirects to
// /help?tab=tickets (App.jsx, covered by the parent, not here).

// HELP_TABS and tabFromParam are pure declarations in Help.jsx (no DOM,
// no imports, no JSX), so the tests below evaluate the shipped code
// itself rather than a copy of the allow-list.
function loadHelpTabs(page) {
  const start = page.indexOf("export const HELP_TABS");
  const end = page.indexOf("export default function Help");
  assert.ok(start !== -1 && end > start, "HELP_TABS and tabFromParam must be declared before the Help component");
  const block = page.slice(start, end).replace(/export /g, "");
  assert.doesNotMatch(block, /</, "tab declarations must be pure JS with no JSX, so they can be evaluated");
  return new Function(`${block}; return { HELP_TABS, tabFromParam };`)();
}

test("help tabs are exactly the two approved tabs, in order, deep-linked by ?tab=", () => {
  const page = read("src/pages/Help.jsx");
  const { HELP_TABS, tabFromParam } = loadHelpTabs(page);
  assert.deepEqual(HELP_TABS, [
    { id: "help", label: "Help articles" },
    { id: "tickets", label: "Support tickets" },
  ]);
  assert.equal(new Set(HELP_TABS.map((tab) => tab.id)).size, 2);
  assert.equal(tabFromParam("help"), "help");
  assert.equal(tabFromParam("tickets"), "tickets");
  assert.equal(tabFromParam("Tickets"), "tickets");
  assert.equal(tabFromParam(""), "help");
  assert.equal(tabFromParam("unknown-tab"), "help");
  assert.equal(tabFromParam(null), "help");
  assert.equal(tabFromParam(undefined), "help");
  assert.match(page, /const tab = tabFromParam\(params\.get\("tab"\)\);/);
  assert.match(page, /useSearchParams\(\)/);
  for (const tab of HELP_TABS) {
    assert.ok(page.includes(`id="help-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="help-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Help Center sections"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
  assert.ok(page.includes("aria-controls={`help-panel-${item.id}`}"), "tab buttons must control their panel");
  assert.ok(page.includes("id={`help-tab-${item.id}`}"), "tab buttons must carry stable ids");
  assert.match(page, /onClick=\{\(\) => setTab\(item\.id\)\}/);
  assert.match(page, /nextParams\.set\("tab",\s*tabFromParam\(next\)\)/);
  // Quality contract: 44px touch targets, wrapping layout with no
  // horizontal overflow at 320px, and the established selected/unselected
  // pairing (bg-primary/text-primary-foreground) from MediaStudio/AgentsTeam.
  assert.ok(page.includes('className="flex flex-wrap gap-2"'), "tablist must wrap instead of overflowing");
  assert.ok(
    page.includes("ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold"),
    "tab buttons must be 44px, use the shared interactive layer, and keep the tab styling",
  );
  assert.ok(page.includes("bg-primary text-primary-foreground"), "selected tab must use the primary pairing");
});

test("default and ?tab=help show the full existing Help content; unknown tabs fall back to help", () => {
  const page = read("src/pages/Help.jsx");
  const { tabFromParam } = loadHelpTabs(page);
  // No ?tab= and ?tab=help both resolve to help; anything else does too.
  assert.equal(tabFromParam(null), "help");
  assert.equal(tabFromParam("help"), "help");
  assert.equal(tabFromParam("support"), "help");
  assert.match(page, /\{tab === "help" && <div role="tabpanel" id="help-panel-help"/);
  // The entire pre-existing Help content sits inside the help panel, in
  // its original order: topics, legal, connections, articles, connection
  // assistance, contact.
  const panelStart = page.indexOf('id="help-panel-help"');
  const ticketsStart = page.indexOf('id="help-panel-tickets"');
  assert.ok(panelStart !== -1 && ticketsStart > panelStart, "help panel must precede the tickets panel");
  const panel = page.slice(panelStart, ticketsStart);
  for (const heading of [
    "help-topics-heading",
    "help-legal-heading",
    "help-connections-heading",
    "help-articles-heading",
    "connection-assistance",
    "help-contact-heading",
  ]) {
    assert.ok(panel.includes(heading), `help panel must still contain ${heading}`);
  }
  assert.match(panel, /Browse by topic/);
  assert.match(panel, /Legal documents &amp; rights/);
  assert.match(panel, /Using connections and AI/);
  assert.match(panel, /Need help connecting an account\?/);
  assert.match(panel, /Still need help\?/);
  // The search box is part of the help tab only: it is hidden on the
  // tickets tab and restored when returning to help.
  const searchAt = page.indexOf('id="help-search"');
  assert.ok(page.slice(0, searchAt).includes('{tab === "help" && <>'), "search must be guarded to the help tab");
  assert.match(page, /How can we help\?/);
  // Help stays a public page: no member gate is added to the route itself.
  assert.doesNotMatch(page, /MemberAccess/);
});

test("?tab=tickets renders the tickets UI for a signed-in member and a sign-in prompt for a guest", () => {
  const page = read("src/pages/Help.jsx");
  assert.match(page, /import SupportTickets from "\.\/SupportTickets"/);
  assert.match(page, /import \{ useAuthSession \} from "@\/hooks\/useAuthSession"/);
  assert.match(page, /\{tab === "tickets" && <div role="tabpanel" id="help-panel-tickets"/);
  assert.match(page, /\{ticketsPanel\(\)\}/);
  // SupportTickets is mounted in exactly one place, inside the gate, so
  // it can never mount for a signed-out visitor or on the help tab.
  assert.equal(page.split("<SupportTickets />").length - 1, 1, "SupportTickets must be mounted in exactly one place");
  assert.ok(
    page.indexOf("function ticketsPanel()") < page.indexOf("<SupportTickets />"),
    "the single SupportTickets mount must be inside ticketsPanel",
  );
  assert.ok(
    page.indexOf('id="help-panel-tickets"') < page.indexOf("{ticketsPanel()}"),
    "ticketsPanel must only render inside the tickets panel",
  );
  // While the session resolves, a loading state — not the panel and not
  // the sign-in card — so no owner-scoped reads fire as anonymous.
  assert.match(page, /if \(authStatus === "loading"\)/);
  assert.match(page, /Checking your account…/);
  assert.match(page, /if \(!user\) return <HelpTicketsSignIn \/>;/);
  assert.match(page, /function HelpTicketsSignIn\(\) \{/);
  assert.match(page, /Sign in to view support tickets/);
  assert.match(page, /Support tickets are private to your account/);
  assert.match(
    page,
    /to=\{`\/login\?returnTo=\$\{encodeURIComponent\("\/help\?tab=tickets"\)\}`\}/,
  );
  // The gate uses the same session shape as AgentsTeam member tabs.
  assert.match(page, /const \{ user, status: authStatus \} = useAuthSession\(\);/);
});

test("?q= filtering still works on the help tab and survives tab switches", () => {
  const page = read("src/pages/Help.jsx");
  // The filter state, search wiring and article matching are unchanged.
  assert.match(page, /const filtered = useMemo\(\(\) => \{/);
  assert.match(page, /function updateFilter\(key, value\) \{/);
  assert.match(page, /onChange=\{\(event\) => updateFilter\("q", event\.target\.value\)\}/);
  assert.match(page, /\{query \|\| category \? "Matching articles" : "Help articles"\}/);
  assert.match(page, /No articles match that search\./);
  assert.match(page, /Clear search and filters/);
  assert.match(page, /HELP_CATEGORIES\.map\(\(item\) => \{/);
  // Switching tabs preserves ?q= (and ?category=) instead of dropping
  // them, so a search is still there when returning to the help tab.
  assert.match(page, /const nextParams = new URLSearchParams\(params\);/);
  assert.match(page, /nextParams\.set\("tab",\s*tabFromParam\(next\)\)/);
  assert.match(page, /setParams\(nextParams, \{ replace: true \}\)/);
});

test("tickets tab preserves SupportTickets behaviour instead of rebuilding it", () => {
  const page = read("src/pages/Help.jsx");
  const tickets = read("src/pages/SupportTickets.jsx");
  // No second ticket form, queue or ticket RPC is built into Help.jsx.
  assert.doesNotMatch(page, /ifund_create_support_ticket/);
  assert.doesNotMatch(page, /ifund_my_support_tickets/);
  assert.doesNotMatch(page, /ifund_super_admin_support_queue/);
  assert.doesNotMatch(page, /New support request/);
  assert.doesNotMatch(page, /Administrator support queue/);
  assert.doesNotMatch(page, /ticket-subject/);
  // The reused component keeps its props (none) and its behaviours:
  // ?request=delete-account pre-fills a deletion request, and the
  // super-admin queue section is still rendered for super-admins.
  assert.match(page, /<SupportTickets \/>/);
  assert.doesNotMatch(page, /<SupportTickets [^/]/);
  assert.match(tickets, /searchParams\.get\("request"\) === "delete-account"/);
  assert.match(tickets, /Request account deletion/);
  assert.match(tickets, /aria-label="Super admin support queue"/);
  assert.match(tickets, /Administrator support queue/);
  // ?request=delete-account survives a tab switch because setTab keeps
  // every other query parameter.
  assert.match(page, /keeps the other query parameters \(\?q=, \?category=,/);
});
