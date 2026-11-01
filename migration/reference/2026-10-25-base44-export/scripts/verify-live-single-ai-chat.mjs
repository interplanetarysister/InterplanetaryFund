import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const appId='6a67a778342a8fe05ee79cba';
const origin=(process.env.IFUND_SMOKE_URL||'https://interplanetaryfund.com').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>localStorage.setItem('base44_access_token','ifund-test-session-not-real'));
  await context.route('**/api/apps/public/prod/public-settings/by-id/**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:appId,public_settings:'public_without_login'}),
  }));
  await context.route('**/api/apps/'+appId+'/entities/User/me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:'ifund-simulated-admin',email:'cuddlemeplatonically@gmail.com',role:'admin',subscription_status:'active'}),
  }));
  const page=await context.newPage();
  const response=await page.goto(origin+'/agents',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200);
  const terms=page.getByRole('button',{name:/I Agree — Continue/});
  if(await terms.count()) await terms.click({timeout:14000});
  await page.getByRole('heading',{name:'Your AI team'}).waitFor({timeout:17000});
  const chatButton=page.getByRole('button',{name:'Chat',exact:true});
  const adminButton=page.getByRole('button',{name:'Admin tools'});
  await chatButton.waitFor({timeout:15000});
  assert.equal(await chatButton.getAttribute('aria-pressed'),'true');
  assert.equal(await adminButton.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('[data-ifund-chat-composer]').count(),1,
    'Chief of Staff must have exactly one ordinary composer on mobile');
  assert.equal(await page.getByText('Super admin development access').count(),0,
    'Admin chat must not appear over the main chat');
  await adminButton.click();
  assert.equal(await page.locator('[data-ifund-chat-composer]').count(),0,
    'Main chat must disappear in admin mode');
  await page.getByText('Super admin development access').waitFor({timeout:8000});
  assert.equal(await adminButton.getAttribute('aria-pressed'),'true');
  await chatButton.click();
  await page.locator('[data-ifund-chat-composer]').waitFor({timeout:12000});
  assert.equal(await page.getByText('Super admin development access').count(),0);
  assert.equal(await page.locator('[data-ifund-chat-composer]').count(),1);
  console.log('PASS: live mobile AI page displays one chat at a time and switches admin tools without overlap');
  await context.close();
} finally {
  await browser.close();
}
