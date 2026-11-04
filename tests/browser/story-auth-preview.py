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
  page=await ctx.new_page(); errors=[]; calls=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def mock(route):
   req=route.request; url=req.url; uid=UID_B if token(UID_B) in req.headers.get('authorization','') else UID_A
   status=200; payload={}
   if '/auth/v1/signup' in url: payload={'user':user(UID_A),'session':None};calls.append(('signup',req.post_data_json,url))
   elif '/auth/v1/user' in url:payload=user(uid)
   elif '/auth/v1/verify' in url:payload=session(UID_A)
   elif '/auth/v1/token' in url:payload=session(UID_B if req.post_data_json.get('email')=='b@example.invalid' else uid)
   elif '/rest/v1/ifund_profiles' in url:payload={'id':uid,'account_status':'active','account_deletion_pending':False}
   elif '/rest/v1/ifund_legal_acceptances' in url:payload={'owner_id':uid,'terms_version':'2026-10-13-v3','explicit_consent':True}
   elif '/rest/v1/ifund_campaigns' in url:payload=[]
   elif '/api/agents/story/drafts' in url:payload={'drafts':[{'id':uid,'status':'draft','payload':{'story':'PRIVATE STORY '+('B' if uid==UID_B else 'A')}}]}
   elif '/rest/v1/' in url:payload=[]
   elif '/auth/v1/' in url:payload={}
   else:await route.abort();return
   await route.fulfill(status=status,content_type='application/json',body=json.dumps(payload),headers={'access-control-allow-origin':'*'})
  await ctx.route('https://ssibsfmtodgximseeqsv.supabase.co/**',mock)
  await ctx.route('**/api/agents/story/**',mock)
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
  print('PASS account switch removes prior private drafts and unsent form text')
  assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
  print('PASS mobile 390px layout has no horizontal overflow')
  await page.goto(ORIGIN+'/reset-password?token_hash=mock&type=recovery')
  await page.get_by_role('button',name='Update password',exact=True).wait_for()
  await page.get_by_label('New password',exact=True).fill('New-test-password-123!')
  await page.get_by_role('button',name='Update password',exact=True).click()
  await page.wait_for_url('**/login',timeout=15000)
  assert '?' not in page.url and '#' not in page.url
  print('PASS token-hash recovery verifies, clears credentials and updates password')
  assert not errors,errors
  await browser.close()
asyncio.run(main())
