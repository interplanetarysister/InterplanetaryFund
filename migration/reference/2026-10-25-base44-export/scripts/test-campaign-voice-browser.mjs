import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4198';
const server=spawn('./node_modules/.bin/vite',['preview','--outDir','/tmp/ifund-voice-build','--host','127.0.0.1','--port','4198','--strictPort'],{stdio:'ignore'});
let browser;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await sleep(150)}assert.ok(ready);
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{
   localStorage.setItem('base44_access_token','ifund_voice_mock_only');
   window.__spoken=[];
   Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(utterance){window.__spoken.push(utterance.text)}}});
   window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
   window.SpeechRecognition=class {start(){this.onstart?.();window.__recognition=this;}stop(){this.onend?.()}abort(){this.onend?.()}};
 });
 const page=await context.newPage();let saved=null;let saves=0;let failSave=false;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/apps/**',async route=>{
   const url=route.request().url();const body=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.includes('public-settings/by-id/'))return body({id:'6a67a778342a8fe05ee79cba',public_settings:'public_without_login'});
   if(url.includes('/User/me'))return body({id:'voice-user',role:'admin',username:'VoiceTester',subscription_tier:'enterprise'});
   if(url.includes('recordLegalAcceptance'))return body({accepted:true,terms_version:'2026-10-13-v3'});
   if(url.includes('/Notification'))return body([]);
   if(url.includes('getFeatureAvailability'))return body({available:{ai_campaign_assistant:true}});
   if(url.includes('getFundraisingMode'))return body({public_campaign_fundraising:true});
   if(url.includes('InvokeLLM')){
     const request=route.request().postDataJSON();const props=request.response_json_schema?.properties || {};
     return body(props.options?{options:['Garden Together','Restore Our Garden','Room to Grow','Neighbors in Bloom','Seeds of Hope']}:{story:'Help local families restore our community garden. Our goal is $2,000 for repairs.',summary:'Restore a community garden for local families.'});
   }
   if(url.includes('generateCampaignCover'))return body({ok:true,url:'data:image/png;base64,'+png});
   if(url.includes('UploadFile'))return body({file_url:'https://media.base44.com/images/public/6a67a778342a8fe05ee79cba/mock.png'});
   if(url.includes('saveCampaign')){
     saves++;if(failSave)return route.fulfill({status:500,contentType:'application/json',body:'{"error":"Campaign could not be saved safely."}'});
     const request=route.request().postDataJSON();saved={...request.campaign,id:'voice-draft',created_by_id:'voice-user'};return body({ok:true,campaign:saved});
   }
   if(url.includes('getCampaignDraft'))return body({ok:true,campaign:saved});
   return body({});
 });
 await page.route('https://media.base44.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png,'base64')}));
 await page.goto(origin+'/create?voice=1',{waitUntil:'domcontentloaded'});
 const panel=page.getByRole('region',{name:'Voice campaign assistant'});await panel.waitFor({timeout:12000}).catch(async error=>{console.log('PAGE',page.url(),(await page.locator('body').innerText()).slice(0,2500),'ERRORS',errors);throw error;});
 const transcript=panel.getByRole('log');
 const send=async text=>{await panel.getByRole('textbox',{name:'Type a voice command'}).fill(text);await panel.getByRole('button',{name:'Send',exact:true}).click();};
 await send('Alexa, help me raise $2,000 to repair our community garden');await transcript.getByText(/Who or what will this help/).waitFor();
 await panel.getByRole('button',{name:'Tap to talk'}).click();
 await page.evaluate(()=>{window.__recognition.onresult({results:[[{transcript:'Local families'}]]});});
 await transcript.getByText(/Thank you. Say show five titles/).waitFor();
 await panel.getByRole('button',{name:'Show five titles',exact:true}).click();await panel.getByRole('list',{name:'Title choices'}).waitFor();
 await send('choose the second title');await transcript.getByText(/Selected Restore Our Garden/).waitFor();
 await panel.getByRole('button',{name:'Write my story',exact:true}).click();await transcript.getByText(/Your story is ready/).waitFor();
 await panel.getByRole('button',{name:'Create a picture',exact:true}).click();await transcript.getByText(/Your campaign illustration is ready below/).waitFor({timeout:20000});
 await panel.getByRole('button',{name:'Save as a draft',exact:true}).click();await transcript.getByText(/Your private draft was saved successfully/).waitFor();
 await panel.getByRole('article',{name:'Current campaign preview'}).getByText(/Help local families restore/).waitFor();
 assert.equal(saves,1);assert.equal(saved.status,'draft');assert.equal(saved.title,'Restore Our Garden');assert.equal(saved.goal_amount,2000);assert.equal(saved.cover_image_is_ai,true);assert.equal(saved.ai_profile.who_helping,'Local families');
 assert.ok(await page.evaluate(()=>window.__spoken.length>4));
 failSave=true;await panel.getByRole('button',{name:'Save as a draft',exact:true}).click();await transcript.getByText(/draft was not confirmed saved/).waitFor();
 assert.equal(await panel.getByText('Private draft saved and confirmed by the campaign server.').count(),0);
 await panel.getByRole('button',{name:'Tap to talk'}).click();await page.evaluate(()=>window.__recognition.onerror({error:'not-allowed'}));await panel.getByRole('alert').getByText(/Microphone permission was denied/).waitFor();
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 console.log('PASS mobile voice/text flow: purpose, beneficiary speech event, title choice, story, art, real API save contract, failed-save honesty, spoken replies, microphone denial, no horizontal overflow. Backend and microphone are mocked; no live AI or audio capture.');
}finally{await browser?.close();server.kill();await sleep(150)}
