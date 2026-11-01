import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:4196';
const server = spawn('./node_modules/.bin/vite',['preview','--host','127.0.0.1','--port','4196','--strictPort'], {cwd:process.cwd(),stdio:'ignore'});
const delay = ms => new Promise(r=>setTimeout(r,ms));
const fixture = {
 id:'campaign-qa-only',status:'active',created_by_id:'another-user',
 title:'A verifiable campaign',category:'community',goal_amount:5000,
 raised_amount:0,donor_count:0,summary:'Help a local project',
 story:'Helping a community complete a project.',accept_crypto_donations:false
};
let browser;
try {
  let ready=false;
  for(let i=0;i<70;i++){try{if((await fetch(origin+'/')).ok){ready=true;break;}}catch{}await delay(180);}
  assert.ok(ready,'Preview server ready');
  browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [320,375,390,768]) {
    const context = await browser.newContext({viewport:{width,height:720},serviceWorkers:'block',colorScheme:'light'});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.route('**/api/apps/public/prod/public-settings/by-id/**',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({id:'6a67a778342a8fe05ee79cba',public_settings:'public_without_login'})
    }));
    await page.route('**/api/apps/**', async route=>{
      const url=route.request().url();
      const respond=(value)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
      if(url.includes('getFundraisingMode')) return respond({public_campaign_fundraising:true});
      if(url.includes('getFeatureAvailability')) return respond({available:{payment_checkout_enabled:true,paypal_checkout:true,google_pay_checkout:false,apple_pay_checkout:false}});
      if(url.includes('getPaymentCapabilities')) return respond({paypal:{api_live:true}});
      if(url.includes('getPayPalConfig')) return respond({api_configured:true,client_id:'sandbox-ui-fixture'});
      if(url.includes('getCampaignDonations')) return respond({donations:[]});
      if(url.includes('CampaignUpdate')) return respond([]);
      if(url.includes('/Campaign')) return respond([fixture]);
      if(url.includes('/User/me')) return route.fulfill({status:401,contentType:'application/json',body:'{}'});
      return respond({});
    });
    await page.route('https://www.paypal.com/sdk/js?**',route=>route.fulfill({
      status:200, contentType:'application/javascript', body:
        "window.paypal={Buttons:()=>({render:async node=>{const b=document.createElement('button');b.type='button';b.textContent='Mock PayPal checkout (no payment)';b.setAttribute('data-qa-paypal','');b.style.cssText='display:block;width:100%;height:44px;border:1px solid #777';node.appendChild(b)},close:()=>{}})};"
    }));
    await page.goto(origin+'/campaign/'+fixture.id,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Donate with PayPal',exact:true}).last().waitFor({timeout:18000});
    await page.getByRole('button',{name:'Donate with PayPal',exact:true}).last().click();
    const dialog=page.getByRole('dialog');
    await dialog.waitFor({state:'visible',timeout:8000});
    await dialog.getByPlaceholder('Custom amount ($)').fill('25');
    const paypal=dialog.locator('[data-qa-paypal]');
    await paypal.waitFor({state:'visible',timeout:14000});
    await paypal.scrollIntoViewIfNeeded();
    const box=await paypal.boundingBox();
    const bounds=await dialog.boundingBox();
    assert.ok(box&&bounds,'PayPal UI has measurable bounds');
    assert.ok(box.x>=bounds.x-2 && box.x+box.width<=bounds.x+bounds.width+2,'PayPal button fits dialog horizontally');
    assert.ok(box.y>=bounds.y-2 && box.y+box.height<=bounds.y+bounds.height+2,'PayPal button is visible inside dialog after scrolling');
    await paypal.click();
    assert.equal(await page.locator('html').evaluate(x=>x.scrollWidth <= window.innerWidth+3),true,'No horizontal overflow');
    assert.deepEqual(errors,[],'No JavaScript exceptions');
    console.log('PASS payment layout',width+'px','button fully visible and clickable; no capture made');
    await context.close();
  }
} finally {await browser?.close();server.kill();await delay(250);}
