import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4195';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const server = spawn('./node_modules/.bin/vite',
  ['preview', '--host', '127.0.0.1', '--port', '4195', '--strictPort'],
  {cwd:process.cwd(),stdio:'ignore'});
let browser;
const publicLinks = ['Home','Discover','Community','IFund Social','Global Globe','Stories & Blogs','Help Center'];
const memberGroups = ['Explore','Campaigns & Giving','Community','AI Tools','Account & Help'];
async function checkSize(page, selector, viewport) {
  return await page.locator(selector).evaluate(el => {
    const panel=el.getBoundingClientRect();
    const labels=[...el.querySelectorAll('.ifund-nav-link')];
    const tallest=labels.reduce((best,link)=>Math.max(best,link.getBoundingClientRect().width),0);
    const longest=labels.reduce((best,link)=>Math.max(best,link.querySelector('.ifund-nav-label')?.scrollWidth||0),0);
    const s=getComputedStyle(el);
    return {left:panel.left, width:panel.width, tallest, longest, opacity:s.backgroundColor, filter:s.backdropFilter,
      allLabelsVisible:labels.every(a=>a.scrollWidth<=a.clientWidth+2)};
  }).then(size=>{
    assert.ok(size.width <= viewport - 20, 'Drawer fits small viewport');
    assert.ok(size.width >= size.tallest && size.width <= size.tallest + 28,
      'Sidebar width follows widest visible link, not a fixed large width: '+JSON.stringify(size));
    assert.ok(size.allLabelsVisible, 'The longest label fits without clipping');
    return size;
  });
}
function setupMember(ctx, role='user') {
  return Promise.all([
    ctx.addInitScript(() => {localStorage.setItem('base44_access_token','ifund_compact_navigation_mock');}),
    ctx.route('**/api/apps/public/prod/public-settings/by-id/**',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({id:'6a67a778342a8fe05ee79cba',public_settings:'public_without_login'}),
    })),
    ctx.route('**/api/apps/6a67a778342a8fe05ee79cba/entities/User/me',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({id:'ifund-qa-member',role,username:'QA-Member',subscription_tier:'free'}),
    })),
    ctx.route('**/*recordLegalAcceptance*',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({accepted:true,terms_version:'2026-10-13-v3'}),
    })),
    ctx.route('**/entities/Notification/**',route=>route.fulfill({
      status:200,contentType:'application/json',body:'[]',
    })),
  ]);
}
try {
  let ready=false;
  for(let n=0;n<65;n++){try{if((await fetch(origin+'/')).ok){ready=true;break}}catch{}await delay(200)}
  assert.ok(ready,'Preview available');
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [320,390,767]){
    const ctx=await browser.newContext({viewport:{width,height:800},colorScheme:'light',serviceWorkers:'block'});
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/community',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Open navigation'}).waitFor({timeout:12000});
    assert.equal(await page.locator('.ifund-mobile-header:visible').count(),1);
    assert.equal(await page.locator('.ifund-workspace-bar:visible').count(),0,
      'Only one mobile header (the duplicate stacked frame must be hidden)');
    await page.getByRole('button',{name:'Open navigation'}).click();
    const sheet=page.getByRole('dialog',{name:'IFund navigation'});
    await sheet.waitFor();
    const measurement=await checkSize(page,'#mobile-menu',width);
    assert.match(measurement.opacity,/rgba\(.+,\s*0\.(?:8|9)/,
      'Sidebar should be slightly translucent');
    const bg=await page.locator('.ifund-drawer-backdrop').evaluate(el=>({
      blur:getComputedStyle(el).backdropFilter,background:getComputedStyle(el).backgroundColor
    }));
    assert.equal(bg.blur,'blur(1px)','Backdrop should blur lightly, not obscure the page');
    assert.ok(bg.background.includes('0.25'),'Backdrop should use a soft dark tint');
    assert.deepEqual(await sheet.locator('.ifund-nav-label').allTextContents(),publicLinks);
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','Modal drawer locks background scroll');
    await page.keyboard.press('Escape');
    await sheet.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    assert.deepEqual(errors,[]);
    console.log('PASS compact guest drawer',width+'px',Math.round(measurement.width)+'px wide, no duplicate header');
    await ctx.close();
  }
  // The compact desktop sidebar occupies the layout rather than requiring the
  // obsolete 240px left padding, so content starts exactly where it ends.
  for(const width of [768,1280]){
    const ctx=await browser.newContext({viewport:{width,height:800},colorScheme:'dark',serviceWorkers:'block'});
    const page=await ctx.newPage();
    await page.goto(origin+'/community',{waitUntil:'domcontentloaded'});
    const aside=page.locator('.ifund-desktop-sidebar');
    await aside.getByRole('link',{name:'Discover'}).waitFor({timeout:14000});
    const measurement=await checkSize(page,'.ifund-desktop-sidebar',width);
    const bounds=await page.locator('main').boundingBox();
    assert.ok(bounds,'Desktop content exists');
    assert.ok(Math.abs(bounds.x-measurement.width)<2,'Main content must start at sidebar edge, no second gutter');
    assert.equal(await page.locator('.ifund-mobile-header:visible').count(),0);
    assert.equal(await page.locator('.ifund-workspace-bar:visible').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'No desktop horizontal overflow');
    console.log('PASS compact desktop sidebar',width+'px',Math.round(measurement.width)+'px wide, content starts immediately');
    await ctx.close();
  }
  for(const role of ['user','admin']){
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await setupMember(ctx,role);
    const page=await ctx.newPage();
    await page.goto(origin+'/community',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Open navigation'}).waitFor({timeout:13000});
    await page.getByRole('button',{name:'Open navigation'}).click();
    const sheet=page.getByRole('dialog',{name:'IFund navigation'});
    const groups=await sheet.locator('[data-ifund-nav-group]').evaluateAll(all=>all.map(x=>x.dataset.ifundNavGroup));
    assert.deepEqual(groups,role==='admin'?[...memberGroups,'Administration']:memberGroups);
    const links=await sheet.locator('.ifund-nav-link').evaluateAll(all=>all.map(x=>({label:x.innerText,href:x.getAttribute('href')})));
    assert.equal(new Set(links.map(x=>x.href)).size,links.length,'Every route appears at most once');
    assert.ok(links.some(x=>x.href==='/help'),'Help remains accessible without the redundant workspace header');
    assert.equal(links.some(x=>x.href==='/admin/integrations'),role==='admin','Admin links remain role-gated');
    const measure=await checkSize(page,'#mobile-menu',390);
    console.log('PASS compact',role,'drawer',Math.round(measure.width)+'px',groups.join(' > '));
    await ctx.close();
  }
} finally {await browser?.close();server.kill();await delay(200)}
