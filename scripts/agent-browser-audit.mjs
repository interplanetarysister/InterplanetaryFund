#!/usr/bin/env node
// Local read-only browser smoke; no login, financial, external publication or mutations.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { browserTarget, permittedReadRequest, safeAuditPath } from "./agent-browser-policy.mjs";

export function parseArgs(args) {
  const out = {url:"https://interplanetaryfund.com",mobile:false,json:""};
  for(let i=0;i<args.length;i++) {
    if(args[i]==="--mobile") out.mobile=true;
    else if(["--url","--json"].includes(args[i]) && args[i+1]) out[args[i].slice(2)]=args[++i];
    else throw Error("Unsupported browser audit argument: " + args[i]);
  }
  browserTarget(out.url);
  return out;
}
export async function browserAudit({url,mobile=false}, chromium) {
  const target = browserTarget(url);
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:"block",acceptDownloads:false});
  const page = await context.newPage(), errors=[],blocked=[];
  try {
    await context.route("**/*",route=>{
      const req=route.request();
      if(!permittedReadRequest(req.url(),req.method(),target)) {
        let safe="invalid";
        try { const u=new URL(req.url());safe=u.origin+u.pathname; } catch {}
        blocked.push({method:req.method(),url:safe});
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    page.on("pageerror",e=>errors.push(String(e.message).slice(0,200)));
    const res=await page.goto(target.href,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForTimeout(1000);
    const final=page.url();
    const validFinal=new URL(final).origin===target.origin;
    const text=await page.locator("body").innerText().catch(()=>"");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    return {audited_at:new Date().toISOString(),target:safeAuditPath(target.href),
      final_url:validFinal?safeAuditPath(final):"blocked",viewport:mobile?"390x844":"1365x900",
      status:res?.status()??null,title:await page.title(),visible_characters:text.trim().length,
      headings:(await page.locator("h1").allTextContents()).slice(0,10),
      horizontal_overflow:overflow,page_errors:errors.slice(0,12),blocked_requests:blocked.slice(0,12),
      passed:validFinal&&res?.ok()===true&&text.trim().length>30&&!overflow,
      role_acceptance:"NOT TESTED: unauthenticated read-only smoke"};
  } finally { await context.close();await browser.close(); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const opts=parseArgs(process.argv.slice(2));
    const {chromium}=await import(process.env.IFUND_PLAYWRIGHT_MODULE||"playwright");
    const report=await browserAudit(opts,chromium);
    if(opts.json) {await mkdir(dirname(opts.json),{recursive:true});await writeFile(opts.json,JSON.stringify(report,null,2)+"\n");}
    console.log(JSON.stringify(report,null,2));
    if(!report.passed) process.exitCode=1;
  } catch(e) { console.error("Browser audit unavailable: "+e.message);process.exitCode=1; }
}
