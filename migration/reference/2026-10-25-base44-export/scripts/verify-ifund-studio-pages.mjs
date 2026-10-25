import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ORIGIN=(process.env.IFUND_SMOKE_URL||'http://127.0.0.1:4191').replace(/\/+$/,'');
const ROUTES=['/','/about','/contact','/discover','/community','/help','/globe',
  '/login','/register','/forgot-password','/activate','/definitely-not-a-real-ifund-page'];
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
let preview;
if(!process.env.IFUND_SMOKE_URL){
  preview=spawn('./node_modules/.bin/vite',['preview','--host','127.0.0.1','--port','4191','--strictPort'],{cwd:process.cwd(),stdio:'ignore'});
  let ready=false;
  for(let tries=0;tries<60;tries++){
    if(preview.exitCode!==null)throw Error('Studio preview exited');
    try{if((await fetch(ORIGIN+'/')).ok){ready=true;break}}catch{}
    await delay(200);
  }
  if(!ready)throw Error('Studio preview did not start');
}
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const setting of [
    {width:390,height:844,colorScheme:'light',name:'mobile-light'},
    {width:1280,height:800,colorScheme:'dark',name:'desktop-dark'},
  ]){
    const context=await browser.newContext({viewport:{width:setting.width,height:setting.height},colorScheme:setting.colorScheme,serviceWorkers:'block'});
    const page=await context.newPage();
    const exceptions=[];
    page.on('pageerror',error=>exceptions.push(error.message.slice(0,240)));
    page.on('console',msg=>{
      if(msg.type()==='error' && /ReferenceError|TypeError|Route render error|Failed to resolve import/.test(msg.text())){
        exceptions.push(msg.text().slice(0,300));
      }
    });
    for(const route of ROUTES){
      exceptions.length=0;
      const response=await page.goto(ORIGIN+route,{waitUntil:'domcontentloaded',timeout:25000});
      assert.equal(response?.status(),200,'Route '+route+' HTTP error');
      const terms=page.getByRole('button',{name:/I Agree — Continue/});
      if(await terms.count()) await terms.click({timeout:12000});
      // Cold published bundles can need longer than a fixed delay to hydrate.
      // Wait for actual page content, preserving a finite failure timeout.
      await page.waitForFunction(() => {
        const root = document.getElementById('root');
        return !!root?.children.length && (document.body?.innerText || '').trim().length > 35;
      }, null, { timeout: 15000 });
      if(route==='/discover') {
        await page.getByRole('heading',{name:'Discover campaigns'}).waitFor({timeout:15000});
      }
      await delay(150);
      const info=await page.evaluate(()=>({
        url:location.pathname,
        text:(document.body?.innerText||'').slice(0,550),
        root:document.getElementById('root')?.children.length||0,
        overflow:document.documentElement.scrollWidth - innerWidth,
        bodyFont:getComputedStyle(document.body).fontFamily,
        headingFont:getComputedStyle(document.querySelector('h1,h2')||document.body).fontFamily,
        workspace:[...document.querySelectorAll('.ifund-workspace-bar')].filter(el=>getComputedStyle(el).display!=='none').length,
        nav:document.querySelectorAll('nav[aria-label="Bottom navigation"]').length,
      }));
      assert.ok(info.root>0,'No React root rendered for '+route+' '+setting.name);
      assert.ok(info.text.length>35,'Empty or blank IFund page '+route+' '+setting.name);
      assert.ok(!info.text.includes('This page hit a snag'),'Page render error '+route+' '+setting.name);
      assert.deepEqual(exceptions,[],'Runtime exception '+route+' '+setting.name);
      assert.ok(info.overflow<=3,'Unexpected horizontal viewport overflow '+route+' '+setting.name+' '+info.overflow+'px');
      if(['/discover','/community','/help'].includes(route)){
        assert.equal(info.workspace,setting.width<768?0:1,
          'Mobile must have only one header; desktop keeps its page context '+route);
        assert.equal(info.nav,1,'Missing responsive navigation '+route);
      }
      if(['/about','/contact'].includes(route)){
        assert.ok(info.bodyFont.includes('Inter'),'Brand font missing '+route);
      }
      if(route.includes('definitely-not-a-real')) assert.ok(info.text.includes("This page isn't available"));
      console.log('PASS studio '+setting.name+' '+route);
    }
    const icons=await page.evaluate(async()=>{
      const paths=['/ifund-logo.jpg','/icon-192.jpg','/icon-512.jpg','/apple-touch-icon.jpg'];
      return await Promise.all(paths.map(async src=>{
        const image=new Image();
        image.src=src;
        try { await image.decode(); return {src,width:image.naturalWidth,height:image.naturalHeight}; }
        catch {return {src,width:0,height:0};}
      }));
    });
    assert.ok(icons.every(icon=>icon.width>0&&icon.height>0),'An official brand/PWA image is broken: '+JSON.stringify(icons));
    console.log('PASS studio '+setting.name+' brand and PWA image decoding');
    await context.close();
  }
  console.log('PASS: unified visual system responsive pages, light/dark modes, all public routes and official imagery.');
} finally {
  await browser?.close();
  if(preview){preview.kill();await delay(250)}
}
