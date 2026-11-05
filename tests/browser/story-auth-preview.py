# Mocked browser regression checks; never creates a real user or sends mail.
import asyncio,base64,json,time
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
UID_A='11111111-1111-4111-8111-111111111111'; UID_B='22222222-2222-4222-8222-222222222222'
ORIGIN='http://localhost:4278'
KEY='sb-ssibsfmtodgximseeqsv-auth-token'
def user(uid): return {'id':uid,'aud':'authenticated','role':'authenticated','email':'test@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}
def token(uid):
 enc=lambda obj:base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600,'aud':'authenticated','role':'authenticated'})+'.mock-signature'
def session(uid):return {'access_token':token(uid),'refresh_token':'mock-refresh-'+uid,'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user(uid)}
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=await browser.new_context(viewport={'width':390,'height':844})
  page=await ctx.new_page(); page.set_default_timeout(10000); errors=[]; calls=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  saved_wording={}; saved_preferences={}; preference_generations={}; runtime={'enabled':True}
  save_started=asyncio.Event(); save_release=asyncio.Event(); get_started=asyncio.Event(); get_release=asyncio.Event()
  async def mock(route):
   req=route.request; url=req.url.replace("/api/services/story_agent/","/api/agents/story/"); uid=UID_A
   bearer=req.headers.get('authorization','').removeprefix('Bearer ')
   try: uid=json.loads(base64.urlsafe_b64decode(bearer.split('.')[1]+'==='))['sub']
   except (ValueError,IndexError,KeyError): pass
   status=200; payload={}
   if '/auth/v1/signup' in url: payload={'user':user(UID_A),'session':None};calls.append(('signup',req.post_data_json,url))
   elif '/auth/v1/user' in url:payload=user(uid)
   elif '/auth/v1/verify' in url:payload=session(UID_A)
   elif '/auth/v1/token' in url:payload=session(UID_B if req.post_data_json.get('email')=='b@example.invalid' else uid)
   elif '/rest/v1/ifund_profiles' in url:payload={'id':uid,'account_status':'active','account_deletion_pending':False}
   elif '/rest/v1/ifund_legal_acceptances' in url:payload={'owner_id':uid,'terms_version':'2026-10-13-v3','explicit_consent':True}
   elif '/rest/v1/ifund_campaigns' in url:payload=[{'id':uid,'owner_id':uid,'title':'Owned campaign','summary':'A summary','story':'A story','category':'community','goal_amount':100,'status':'draft','created_at':'2026-01-01T00:00:00Z','updated_at':'2026-01-01T00:00:00Z'}]
   elif '/api/agents/story/queued-requests' in url:payload={'queued_requests':[]}
   elif '/api/agents/story/subscription' in url:
    if runtime['enabled']:payload={'active':True,'level':1}
    else:status=503;payload={'error':'The writing assistant is not available yet.'}
   elif '/api/agents/story/drafts' in url:payload={'drafts':[{'id':uid,'campaign_id':uid,'status':'draft','updated_at':'2026-11-04T00:00:00Z','source_system':'ifund_story_v1','payload':{'titles':['Title A','Title B','Title C','Title D','Title E'],'summaries':['Summary A','Summary B'],'story':'PRIVATE STORY '+('B' if uid==UID_B else 'A')}}]+([saved_wording[uid]] if uid in saved_wording else [])}
   elif '/api/agents/story/select' in url:
    body=req.post_data_json
    assert body['title_index']==2 and body['summary_index']==1 and body['campaign_id']==uid
    draft={'id':'33333333-3333-4333-8333-333333333333','campaign_id':uid,'status':'draft','source_system':'ifund_story_accepted_v1','updated_at':'2026-11-04T00:01:00Z','payload':{'title':'Title C','summary':'Summary B','story':'PRIVATE STORY A'}}
    saved_wording[uid]=draft;payload={'draft':draft,'campaign_changed':False,'needs_owner_review':True}
   elif '/api/agents/story/revise' in url:
    body=req.post_data_json;assert body['revision']==saved_wording[uid]['updated_at']
    saved_wording[uid]={**saved_wording[uid],'payload':body['payload'],'updated_at':'2026-11-04T00:02:00Z'};payload=saved_wording[uid]
   elif '/api/agents/story/preferences' in url:
    scope=parse_qs(urlparse(url).query).get('campaign_id',[None])[0]
    if req.method=='POST':
     if runtime.pop('delay_save',False):save_started.set();await save_release.wait()
     body=req.post_data_json;scope=body.get('campaign_id');assert body['generation']==preference_generations.get(uid,0)
     saved_preferences[(uid,scope)]={'preferences':body['preferences'],'revision':'2026-11-04T00:01:00Z','generation':preference_generations.get(uid,0)}
    payload={**saved_preferences.get((uid,scope),{'preferences':{},'revision':None}),'generation':preference_generations.get(uid,0)}
    if req.method=='GET' and runtime.pop('delay_get',False):get_started.set();await get_release.wait()
   elif '/api/agents/story/clear-preferences' in url:
    body=req.post_data_json
    for key in list(saved_preferences):
     if key[0]==uid and (body.get('all_scopes') or key[1]==body.get('campaign_id')):saved_preferences.pop(key)
    preference_generations[uid]=preference_generations.get(uid,0)+1;payload={'cleared':True,'generation':preference_generations[uid]}
   elif '/rest/v1/' in url:payload=[]
   elif '/auth/v1/' in url:payload={}
   else:await route.abort();return
   await route.fulfill(status=status,content_type='application/json',body=json.dumps(payload),headers={'access-control-allow-origin':'*'})
  await ctx.route('https://ssibsfmtodgximseeqsv.supabase.co/**',mock)
  await ctx.route('**/api/agents/story/**',mock)
  await ctx.route('**/api/services/story_agent/**',mock)
  # Signup keeps safe return path and switching mode restores password login.
  await page.goto(ORIGIN+'/register?returnTo=%2Fagents')
  await page.wait_for_timeout(1000)
  await page.get_by_label('Email address').fill('member@example.invalid')
  await page.get_by_label('Password',exact=True).fill('Test-password-123!')
  await page.get_by_label('Confirm password',exact=True).fill('Test-password-123!')
  await page.get_by_role('button',name='Create account',exact=True).click()
  await page.get_by_label('Email confirmation code').wait_for()
  redirect=parse_qs(urlparse(calls[0][2]).query)['redirect_to'][0]
  assert urlparse(redirect).path=='/auth/callback'
  assert parse_qs(urlparse(redirect).query)['returnTo']==['/agents']
  await page.get_by_role('link',name='Sign in',exact=True).click()
  await page.get_by_label('Password',exact=True).wait_for()
  assert await page.get_by_label('Email confirmation code').count()==0
  print('PASS signup pending -> password login; return path preserved')
  # Preexisting dashboard implicit callback is rescued and credentials stripped.
  s=session(UID_A)
  await page.goto(ORIGIN+'/dashboard#access_token='+s['access_token']+'&refresh_token='+s['refresh_token'])
  await page.wait_for_url('**/dashboard',timeout=15000)
  assert await page.evaluate('location.hash')==''
  print('PASS legacy dashboard callback -> confirmed session; URL cleared')
  # A tab changing its authenticated user must remove prior private content.
  await page.goto(ORIGIN+'/agents')
  await page.get_by_text('PRIVATE STORY A',exact=True).wait_for()
  suggestion=page.locator('article').filter(has=page.get_by_text('PRIVATE STORY A',exact=True))
  await suggestion.get_by_label('Title C',exact=True).check()
  await suggestion.get_by_label('Summary B',exact=True).check()
  await suggestion.get_by_role('button',name='Save selected wording for review').click()
  await page.get_by_label('Title',exact=True).fill('My reviewed title')
  await page.get_by_role('button',name='Save wording edits').click()
  await page.get_by_text('Your wording edits are saved for review. Your campaign has not changed.',exact=True).wait_for()
  assert saved_wording[UID_A]['payload']['title']=='My reviewed title'
  print('PASS explicit title/summary selection and wording edits save review drafts only')
  await page.get_by_label('Preferred tone',exact=True).fill('Hopeful for my campaigns')
  await page.get_by_role('button',name='Save preferences',exact=True).click()
  await page.get_by_text('Your preferences are saved. New corrections replace earlier preferences in this scope.',exact=True).wait_for()
  await page.get_by_label('Campaign (optional)',exact=True).select_option(UID_A)
  await page.get_by_label('Preferred tone',exact=True).fill('Calm for this campaign')
  await page.get_by_role('button',name='Save preferences',exact=True).click()
  await page.get_by_text('Your preferences are saved. New corrections replace earlier preferences in this scope.',exact=True).wait_for()
  assert saved_preferences[(UID_A,None)]['preferences']['tone']=='Hopeful for my campaigns'
  assert saved_preferences[(UID_A,UID_A)]['preferences']['tone']=='Calm for this campaign'
  print('PASS owner and campaign preferences remain separate')
  runtime['delay_save']=True
  await page.get_by_label('Preferred tone',exact=True).fill('A corrected campaign tone')
  await page.get_by_role('button',name='Save preferences',exact=True).click()
  await asyncio.wait_for(save_started.wait(),5)
  assert await page.get_by_role('button',name='Clear all saved writing preferences',exact=True).is_disabled()
  assert await page.get_by_label('Campaign (optional)',exact=True).is_disabled()
  save_release.set()
  await page.get_by_text('Your preferences are saved. New corrections replace earlier preferences in this scope.',exact=True).wait_for()
  print('PASS pending preference saves serialize clear-all and campaign switching')
  runtime['delay_get']=True
  await page.goto(ORIGIN+'/agents')
  await asyncio.wait_for(get_started.wait(),5)
  await page.get_by_role('button',name='Clear all saved writing preferences',exact=True).click()
  await page.get_by_text('Your saved writing preferences have been cleared.',exact=True).wait_for()
  get_release.set()
  await page.wait_for_timeout(200)
  assert await page.get_by_label('Preferred tone',exact=True).input_value()==''
  print('PASS delayed preference loads cannot restore cleared values')
  await page.get_by_label('What should people know?').fill('PRIVATE UNSENT ORGANIZER A TEXT')
  await page.evaluate('''([key,session])=>{const channel=new BroadcastChannel(key);channel.postMessage({event:'TOKEN_REFRESHED',session});setTimeout(()=>channel.close(),100);}''',[KEY,session(UID_A)])
  await page.wait_for_timeout(200)
  assert await page.get_by_label('What should people know?').input_value()=='PRIVATE UNSENT ORGANIZER A TEXT'
  print('PASS same-user token refresh preserves unsent form')
  second=await ctx.new_page()
  await second.goto(ORIGIN+'/login?returnTo=%2Fagents')
  await second.get_by_label('Email address').fill('b@example.invalid')
  await second.get_by_label('Password',exact=True).fill('Test-password-123!')
  await second.get_by_role('button',name='Sign in',exact=True).click()
  await page.get_by_text('PRIVATE STORY B',exact=True).wait_for(timeout=15000)
  assert await page.get_by_text('PRIVATE STORY A',exact=True).count()==0
  assert await page.get_by_label('What should people know?').input_value()==''
  assert await page.get_by_label('Preferred tone',exact=True).input_value()==''
  assert await page.get_by_label('Title',exact=True).count()==0
  print('PASS account switch removes prior private drafts and unsent form text')
  assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
  print('PASS mobile 390px layout has no horizontal overflow')
  runtime['enabled']=False
  await page.goto(ORIGIN+'/agents')
  await page.get_by_role('alert').filter(has_text='Writing suggestions are temporarily unavailable').wait_for()
  await page.get_by_role('button',name='Clear all saved writing preferences',exact=True).click()
  await page.get_by_text('Your saved writing preferences have been cleared.',exact=True).wait_for()
  assert preference_generations.get(UID_B)==1
  assert not any(key[0]==UID_B for key in saved_preferences)
  print('PASS clearing own preferences remains available when the agent is disabled')
  await page.goto(ORIGIN+'/reset-password?token_hash=mock&type=recovery')
  await page.get_by_role('button',name='Update password',exact=True).wait_for()
  await page.get_by_label('New password',exact=True).fill('New-test-password-123!')
  await page.get_by_role('button',name='Update password',exact=True).click()
  await page.wait_for_url('**/login?returnTo=*',timeout=15000)
  assert urlparse(page.url).path=='/login' and parse_qs(urlparse(page.url).query)=={'returnTo':['/dashboard']} and '#' not in page.url
  print('PASS token-hash recovery verifies, clears credentials and updates password')
  await page.goto(ORIGIN+'/create')
  await page.get_by_label('Campaign title',exact=True).fill('GUEST CAMPAIGN FACTS')
  await page.reload()
  assert await page.get_by_label('Campaign title',exact=True).input_value()=='GUEST CAMPAIGN FACTS'
  await page.get_by_text('Sign in to continue',exact=True).wait_for()
  print('PASS guest composer restores local text while save/publish stay member-gated')
  await second.goto(ORIGIN+'/login?returnTo=%2Fcreate')
  await second.get_by_label('Email address').fill('b@example.invalid')
  await second.get_by_label('Password',exact=True).fill('Test-password-123!')
  await second.get_by_role('button',name='Sign in',exact=True).click()
  await page.wait_for_timeout(400)
  assert await page.get_by_label('Campaign title',exact=True).input_value()=='GUEST CAMPAIGN FACTS'
  await page.get_by_label('Campaign title',exact=True).fill('PRIVATE OWNER B CAMPAIGN')
  print('PASS guest text transfers to first confirmed owner')
  await second.goto(ORIGIN+'/login?returnTo=%2Fcreate')
  await second.get_by_label('Email address').fill('a@example.invalid')
  await second.get_by_label('Password',exact=True).fill('Test-password-123!')
  await second.get_by_role('button',name='Sign in',exact=True).click()
  await page.wait_for_timeout(400)
  assert await page.get_by_label('Campaign title',exact=True).input_value()==''
  assert 'PRIVATE OWNER B CAMPAIGN' not in await page.locator('body').inner_text()
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  print('PASS account switch removes prior owner campaign text; mobile fits')
  assert not errors,errors
  await browser.close()
asyncio.run(main())
