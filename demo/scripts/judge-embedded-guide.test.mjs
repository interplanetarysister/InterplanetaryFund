import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judgeGuideHtml, judgeGuideCss, judgeGuideScript } from "../worker/judge-embedded-guide.js";

const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");

test("standalone guided view uses the real same-origin sandbox rather than mock screens",()=>{
  assert.match(judgeGuideHtml, /<iframe id="ifund-demo-frame"[^>]+src="\/hackathon"/);
  assert.match(judgeGuideHtml, /<aside id="judge-guide"/);
  assert.match(judgeGuideHtml, /<link rel="stylesheet" href="\/api\/judge-guide\.css"/);
  assert.match(judgeGuideHtml, /<script defer src="\/api\/judge-guide\.js"/);
  assert.match(judgeGuideHtml, /Fictional campaigns · No real funds/);
});

test("guide card is outside the iframe at desktop and mobile layouts",()=>{
  assert.match(judgeGuideCss, /\.judge-shell\{display:grid;grid-template-columns:minmax\(0,1fr\) 348px/);
  assert.match(judgeGuideCss, /\.demo-stage\{display:flex;flex-direction:column/);
  assert.match(judgeGuideCss, /#ifund-demo-frame\{width:100%;height:100%;flex:1/);
  assert.match(judgeGuideCss, /@media\(max-width:690px\)\{\.judge-shell\{display:flex;flex-direction:column/);
  assert.match(judgeGuideCss, /\.guide-rail\{flex:0 0 auto;max-height:40dvh/);
  assert.doesNotMatch(judgeGuideCss, /\.guide-rail\{[^}]*position:(?:fixed|absolute)/);
});

test("highlight ring cannot intercept any demo pointer, mouse or keyboard action",()=>{
  assert.match(judgeGuideScript, /pointer-events:none!important/);
  assert.match(judgeGuideScript, /getBoundingClientRect\(\)/);
  assert.match(judgeGuideScript, /doc\.body\.appendChild\(marker\)/);
  assert.match(judgeGuideScript, /window\.__IFUND_JUDGE_GUIDE_CHECK__/);
  assert.match(judgeGuideScript, /instructionsOutsideIframe:true,screenOverlap:false/);
});

test("guide covers seven functioning routes without creating synthetic payment receipts",()=>{
  for(const part of ["/hackathon","/create","/discover","/campaign/","/checkout","/dashboard","/map"])
    assert.ok(judgeGuideScript.includes('path:"'+part+'"'),"Expected "+part);
  assert.match(judgeGuideScript, /only a provider-verified/i);
  assert.match(judgeGuideScript, /no payment/i);
  assert.doesNotMatch(judgeGuideScript, /fetch\(\s*["']\/api\/paypal|\/api\/payments\/capture-order|\.rpc\(/i);
  assert.match(judgeGuideScript, /frame\.contentWindow\.location/);
  assert.match(judgeGuideScript, /sessionStorage\.setItem/);
});

test("worker serves guide on existing API routes without changing sandbox handler or static asset binding",()=>{
  assert.match(worker, /path\.startsWith\("\/api\/judge-guide"\)/);
  assert.match(worker, /judgeGuideHtml, judgeGuideCss, judgeGuideScript/);
  assert.match(worker, /if \(!path\.startsWith\("\/api\/"\)\)/);
  assert.match(worker, /env\.ASSETS\.fetch\(request\)/);
  assert.match(worker, /frame-src 'self'/);
});

test("frontend guide JS syntax compiles and supports keyboard-accessible controls",()=>{
  assert.doesNotThrow(()=>new Function(judgeGuideScript));
  assert.match(judgeGuideHtml,/id="guide-back"/);
  assert.match(judgeGuideHtml,/id="guide-next"/);
  assert.match(judgeGuideHtml,/role="progressbar"/);
  assert.match(judgeGuideHtml,/aria-live="polite"/);
  assert.match(judgeGuideHtml,/Skip to walkthrough instructions/);
});
