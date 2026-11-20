import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");

test("single premium background surface is imported after legacy studio layers",()=>{
 const index=read("apps/web/src/index.css");
 assert.ok(index.indexOf('styles/premium-surface.css') > index.indexOf('styles-studio.css'));
 const surface=read("apps/web/src/styles/premium-surface.css");
 for(const selector of [".ifund-shell [data-page-scroll]",".ifund-public:not(.ifund-auth)",".dark .ifund-shell [data-page-scroll]"])
   assert.ok(surface.includes(selector), "missing shared layout surface "+selector);
 assert.match(surface,/background-position:\s*center top, center top 4rem, center/);
 assert.match(surface,/prefers-contrast:\s*more/);
 assert.match(surface,/@media print/);
});

test("Ask IFund launcher and QuickActions occupy different desktop and mobile zones",()=>{
 const surface=read("apps/web/src/styles/premium-surface.css");
 const quick=read("apps/web/src/components/QuickActions.jsx");
 const companion=read("apps/web/src/components/agents/GlobalAgentCompanion.jsx");
 assert.match(quick,/md:right-6/);
 assert.match(quick,/left-3 md:left-auto/);
 assert.match(surface,/bottom:\s*calc\(6\.5rem \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(surface,/@media \(max-width: 767px\)[\s\S]*?\.ifund-global-agent-launcher\s*\{[\s\S]*?left:\s*auto;[\s\S]*?right:\s*max\(12px, env\(safe-area-inset-right\)\)/);
 assert.match(companion,/ifund-global-agent-launcher/);
 assert.match(companion,/aria-label="Ask IFund/);
});

test("cosmic motif is symmetric and does not request external decorative resources",()=>{
 const s=read("apps/web/src/styles/premium-surface.css");
 const matches=[...s.matchAll(/url\("data:image\/svg\+xml,([^"]+)"\)/g)];
 assert.ok(matches.length>=2);
 const svg=decodeURIComponent(matches[0][1]);
 assert.ok(svg.includes('cx="400" cy="400"'));
 assert.ok(svg.includes('M400 106L654.61 253L654.61 547L400 694L145.39 547L145.39 253Z'));
 assert.ok(svg.includes('M106 400L694 400'));
 assert.doesNotMatch(s,/https?:\/\//);
 assert.doesNotMatch(s,/animation:|background-attachment:\s*fixed/);
});
