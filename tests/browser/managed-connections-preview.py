# Browser UI fixtures only. No real identity, grant, provider connection or consent is created.
import asyncio,base64,json,time
from playwright.async_api import async_playwright
UID='11111111-1111-4111-8111-111111111111';OTHER='22222222-2222-4222-8222-222222222222';ORIGIN='http://localhost:4283';KEY='sb-ssibsfmtodgximseeqsv-auth-token';POLICY='ifund-help-2026-11-v1'
def user(uid):return {'id':uid,'aud':'authenticated','role':'authenticated','email':'test@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}
def session(uid):
 enc=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
 return {'access_token':enc({'alg':'HS256'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600,'aud':'authenticated','role':'authenticated'})+'.mock','refresh_token':'mock-'+uid,'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user(uid)}
async def main():
 providers=json.load(open('worker/connections/provider-catalog.json'))['providers'];providers=[{k:p[k] for k in ['id','name','kind','logo']} for p in providers]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=await browser.new_context(viewport={'width':390,'height':844});page=await ctx.new_page();page.set_default_timeout(12000)
  permissions={UID:[],OTHER:[]};requests={UID:[],OTHER:[]};calls=[];receipts={};runtime={'managed':True,'ambiguous':True,'stale':False};errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def new_id(i):return f'aaaaaaaa-aaaa-4aaa-8aaa-{i:012d}'
  async def mock(route):
   req=route.request;url=req.url;uid=UID;payload={};status=200
   try:uid=json.loads(base64.urlsafe_b64decode(req.headers['authorization'].split('.')[1]+'==='))['sub']
   except:pass
   if '/auth/v1/user' in url:payload=user(uid)
   elif '/auth/v1/token' in url:payload=session(OTHER)
   elif '/rest/v1/ifund_profiles' in url:payload={'id':uid,'account_status':'active','account_deletion_pending':False}
   elif '/rest/v1/ifund_legal_acceptances' in url:payload={'owner_id':uid,'terms_version':'2026-10-13-v3','explicit_consent':True}
   elif '/api/agents/connections/workspace' in url:payload={'policy_version':POLICY,'managed_available':runtime['managed'],'providers':providers,'campaigns':[{'id':uid,'title':'PRIVATE '+uid[-4:]+' campaign'}],'connections':[{'id':'cccccccc-cccc-4ccc-8ccc-cccccccccccc','provider':'discord','status':'connected','verified_at':'2026-11-05T00:00:00Z'}],'permissions':permissions[uid],'requests':requests[uid]}
   elif '/api/agents/connections/' in url:
    action=url.rsplit('/',1)[-1];b=req.post_data_json;calls.append((action,b));op=b['operation_id']
    if op in receipts:payload=receipts[op]
    elif action=='grant-help':
     row={'id':new_id(len(permissions[uid])+1),'provider':b['provider'],'campaign_id':b['campaign_id'],'policy_version':POLICY,'status':'active','revision':UID,'expires_at':'2026-12-05T12:00:00Z'};permissions[uid].insert(0,row);payload={'permission':row};receipts[op]=payload
    elif action=='requests':
     row={'id':new_id(100+len(requests[uid])),'provider':b['provider'],'campaign_id':b['campaign_id'],'action':b['action'],'status':'waiting_external','state':'setup_required','revision':UID,'message':'IFund is still setting up this connection. You do not need to change anything on your account.'};requests[uid].insert(0,row);payload={'request':row};receipts[op]=payload
     if runtime['ambiguous']:status=503;payload={'error':'Connection response interrupted.'};runtime['ambiguous']=False
    elif action=='change-selected':
     if runtime['stale']:status=409;payload={'error':'These connection records changed. Reload before choosing again.'};runtime['stale']=False
     else:
      ids=[x['id'] for x in b['items']]
      for row in (permissions[uid] if b['kind']=='revoke' else requests[uid]):
       if row['id'] in ids:row['status']='revoked' if b['kind']=='revoke' else 'cancelled'
      payload={'message':'IFund help permission revoked.' if b['kind']=='revoke' else 'Selected requests cancelled.','changed':ids,'provider_access_revoked':False};receipts[op]=payload
   elif '/rest/v1/' in url:payload=[]
   elif '/auth/v1/' in url:payload={}
   else:await route.abort();return
   await route.fulfill(status=status,content_type='application/json',body=json.dumps(payload),headers={'access-control-allow-origin':'*'})
  await ctx.route('https://ssibsfmtodgximseeqsv.supabase.co/**',mock);await ctx.route('**/api/agents/connections/**',mock)
  await page.goto(ORIGIN+'/connections?connect=discord');await page.get_by_text('Sign in to continue',exact=True).wait_for();print('PASS member guard')
  await page.evaluate('([k,s])=>localStorage.setItem(k,JSON.stringify(s))',[KEY,session(UID)]);await page.reload();await page.get_by_role('heading',name='Help with Discord',exact=True).wait_for();assert await page.get_by_role('button',name='Allow IFund help',exact=True).is_disabled();assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert await page.locator('img[src^="/platform-logos/"]').count()==42;print('PASS43 provider catalog,42 assets, stable deep link and mobile layout')
  await page.get_by_role('region',name='Saved connection records').get_by_text('Verification required',exact=True).wait_for();print('PASS saved legacy connected timestamp never claims current access')
  await page.get_by_label('Campaign scope',exact=True).select_option(UID);await page.get_by_role('checkbox',name='Allow IFund to help').check();await page.get_by_role('button',name='Allow IFund help',exact=True).click();await page.get_by_role('status').filter(has_text='permission saved').wait_for();g=[x[1] for x in calls if x[0]=='grant-help'][0];assert g['campaign_id']==UID and g['confirmed'] is True and g['policy_version']==POLICY;assert not any(k in g for k in ['owner_id','access_token','admin']);print('PASS explicit scoped permission binds current version')
  await page.get_by_role('button',name='Save help request',exact=True).click();await page.get_by_role('alert').filter(has_text='interrupted').wait_for();assert await page.get_by_role('button',name='Save help request',exact=True).is_disabled();await page.get_by_role('button',name='Retry same request',exact=True).click();await page.get_by_role('region',name='Connection help requests').get_by_text('waiting external',exact=True).wait_for();r=[x[1] for x in calls if x[0]=='requests'];assert r[0]==r[1] and len(requests[UID])==1;print('PASS interrupted response retries exact receipt without duplicate or fake connection')
  await page.get_by_role('region',name='Connection help requests').get_by_role('checkbox').check();await page.get_by_role('button',name='Review selected cancellations',exact=True).click();assert not [x for x in calls if x[0]=='change-selected'];await page.get_by_role('button',name='Confirm cancellation',exact=True).click();await page.get_by_role('status').filter(has_text='cancelled').wait_for();assert requests[UID][0]['status']=='cancelled';print('PASS bulk cancellation requires explicit selected review')
  await page.get_by_role('region',name='IFund help permissions').get_by_role('checkbox').check();await page.get_by_role('button',name='Review selected revocations',exact=True).click();runtime['stale']=True;await page.get_by_role('button',name='Confirm revocation',exact=True).click();await page.get_by_role('alert').filter(has_text='records changed').wait_for();assert permissions[UID][0]['status']=='active';await page.get_by_role('button',name='Reload connections',exact=True).click();await page.get_by_role('region',name='Review selected connection changes').wait_for(state='hidden');assert not await page.get_by_role('region',name='IFund help permissions').get_by_role('checkbox').is_checked();print('PASS stale selected review cannot show false revocation')
  await page.get_by_role('checkbox',name='Allow IFund to help').count() # Existing provider has saved permission.
  await page.evaluate("history.pushState(null,'','/connections?connect=facebook');dispatchEvent(new PopStateEvent('popstate'))")
  await page.get_by_role('heading',name='Help with Facebook',exact=True).wait_for();assert await page.get_by_label('Campaign scope',exact=True).input_value()=='';assert not await page.get_by_role('checkbox',name='Allow IFund to help').is_checked();assert await page.get_by_role('region',name='Review selected connection changes').count()==0;print('PASS same-route provider navigation clears consent and campaign scope')
  runtime['managed']=False;await page.get_by_role('button',name='Reload connections',exact=True).click();await page.get_by_text('Managed connection help requires',exact=False).wait_for();assert await page.get_by_role('button',name='Allow IFund help',exact=True).count()==0;await page.get_by_role('region',name='IFund help permissions').get_by_role('checkbox').check();await page.get_by_role('button',name='Review selected revocations',exact=True).click();await page.get_by_role('button',name='Confirm revocation',exact=True).click();await page.get_by_role('status').filter(has_text='permission revoked').wait_for();assert permissions[UID][0]['status']=='revoked';print('PASS plan expiry preserves owner revocation access')
  second=await ctx.new_page();await second.goto(ORIGIN+'/login');await second.get_by_label('Email address').fill('other@example.invalid');await second.get_by_label('Password',exact=True).fill('Test-password-123!');await second.get_by_role('button',name='Sign in',exact=True).click();await page.get_by_role('region',name='Connection help requests').get_by_text('No help requests saved.',exact=True).wait_for();assert await page.get_by_label('Campaign scope',exact=True).input_value()=='';assert await page.get_by_text('PRIVATE1111campaign',exact=True).count()==0;assert await page.get_by_role('region',name='IFund help permissions').get_by_text('No help permission saved.',exact=True).count()==1;print('PASS account switch clears private scope, permissions, requests and selection')
  assert not errors,errors;await browser.close()
asyncio.run(main())
