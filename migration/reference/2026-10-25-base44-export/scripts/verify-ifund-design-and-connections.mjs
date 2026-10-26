import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4194';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const server = spawn('./node_modules/.bin/vite', ['preview','--host','127.0.0.1','--port','4194','--strictPort'], { cwd:process.cwd(), stdio:'ignore' });
let browser;
try {
  let ready = false;
  for (let n=0;n<50;n++) {
    try { if ((await fetch(origin+'/')).ok) { ready=true; break; } } catch {}
    await delay(200);
  }
  assert.ok(ready,'Vite preview ready');

  browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context = await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
  const page = await context.newPage();
  await page.goto(origin+'/community', { waitUntil:'domcontentloaded' });
  const darkButton = page.getByRole('button',{name:'Switch to dark theme'});
  await darkButton.waitFor({timeout:12000});
  await darkButton.click();
  assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('dark')),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ifund-theme')),'dark');
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.getByRole('button',{name:'Switch to light theme'}).waitFor({timeout:12000});
  assert.equal(await page.locator('html').evaluate(node=>node.classList.contains('dark')),true);
  await page.getByRole('button',{name:'Switch to light theme'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('ifund-theme')),'light');

  await page.getByRole('button',{name:'Open navigation'}).click();
  const drawer = page.getByRole('dialog',{name:'IFund navigation'});
  await drawer.waitFor({state:'visible'});
  await page.getByRole('button',{name:'Close navigation'}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Close navigation');
  assert.equal(await page.locator('body').evaluate(el=>el.style.overflow),'hidden');
  assert.equal(await page.locator('.ifund-drawer-backdrop').count(),1,'Drawer should soften/dim rest of page');
  await page.keyboard.press('Escape');
  await drawer.waitFor({state:'detached'});
  assert.notEqual(await page.locator('body').evaluate(el=>el.style.overflow),'hidden');
  console.log('PASS: persisted light/dark preference and keyboard-accessible dimmed mobile drawer');
  await context.close();

  // Route fixtures are in-memory only: no real member or account credentials.
  const member = await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});
  await member.addInitScript(()=>{localStorage.setItem('base44_access_token','ifund_design_smoke_mock');localStorage.setItem('ifund-theme','light');});
  await member.route('**/api/apps/public/prod/public-settings/by-id/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:'6a67a778342a8fe05ee79cba',public_settings:'public_without_login'}),
  }));
  await member.route('**/api/apps/6a67a778342a8fe05ee79cba/entities/User/me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:'test-only-account',username:'DesignTester',role:'user',subscription_tier:'free'}),
  }));
  await member.route('**/*recordLegalAcceptance*',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({accepted:true,terms_version:'2026-10-13-v3'}),
  }));
  await member.route('**/*listConnections*',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({connections:[]}),
  }));
  await member.route('**/*getSharedConnectorStatus*',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({shared:[]}),
  }));
  const signed = await member.newPage();
  await signed.goto(origin+'/create',{waitUntil:'domcontentloaded'});
  const stepList = signed.getByRole('list',{name:/Campaign setup/});
  await stepList.waitFor({timeout:13000});
  assert.equal(await stepList.getByRole('listitem').count(),4,'Campaign wizard must show four distinct stages');
  for(const stage of ['Your Details','Basics','Your Story','Launch']) {
    assert.ok((await stepList.innerText()).includes(stage),stage+' stage must be named');
  }
  assert.ok((await stepList.locator('svg').count())>=4,'Campaign stages must use memorable vector icons');
  assert.equal(await signed.locator('html').evaluate(n=>n.classList.contains('dark')),false,
    'An explicitly selected light theme must override a dark-system preference');
  console.log('PASS: four icon-based campaign stages and theme preference overriding device defaults');

  await signed.goto(origin+'/connections',{waitUntil:'domcontentloaded'});
  const search = signed.getByRole('textbox',{name:'Search available platforms'});
  await search.waitFor({timeout:16000});
  await signed.getByRole('button',{name:/Set up GoFundMe/}).waitFor();
  assert.ok(await signed.locator('img[src="/platform-logos/gofundme.svg"]').count(),'GoFundMe must have a local logo');
  await signed.getByRole('button',{name:'Social',exact:true}).click();
  assert.equal(await signed.getByRole('button',{name:/Set up GoFundMe/}).count(),0);
  assert.ok(await signed.getByRole('button',{name:/Set up Instagram/}).count());
  await signed.getByRole('button',{name:'All',exact:true}).click();
  await search.fill('kickstarter');
  assert.ok(await signed.getByRole('button',{name:/Set up Kickstarter/}).count());
  assert.equal(await signed.getByRole('button',{name:/Set up Instagram/}).count(),0);
  console.log('PASS: verified connection-grid search, category filters, and local provider logos');
  await member.close();
} finally {
  await browser?.close();
  server.kill();
  await delay(200);
}
