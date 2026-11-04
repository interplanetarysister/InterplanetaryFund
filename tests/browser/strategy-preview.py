# Mocked UI acceptance: no real account, consent or campaign writes.
import asyncio,base64,json,time
from playwright.async_api import async_playwright
UID='11111111-1111-4111-8111-111111111111';OTHER='22222222-2222-4222-8222-222222222222';ORIGIN='http://localhost:4279';KEY='sb-ssibsfmtodgximseeqsv-auth-token'
def user(uid):return {'id':uid,'aud':'authenticated','role':'authenticated','email':'test@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}
def session(uid):
 enc=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
 token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600,'aud':'authenticated','role':'authenticated'})+'.mock'
 return {'access_token':token,'refresh_token':'mock-'+uid,'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user(uid)}
def rec(i,uid):return {'id':f'aaaaaaaa-aaaa-4aaa-8aaa-{i:012d}','title':f'PRIVATE {uid[-4:]} recommendation {i}','campaign_title':'My campaign','description':'Explain the actual need','reasoning':'Use verified facts','evidence':'School supplies','confidence':'medium','expected_impact':'May improve understanding','estimated_effort':'One hour','status':'open','updated_at':'2026-11-04T06:00:00.123456Z'}
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=await browser.new_context(viewport={'width':390,'height':844});page=await ctx.new_page();page.set_default_timeout(12000)
  rows={UID:[rec(i,UID) for i in range(1,4)],OTHER:[rec(9,OTHER)]};calls=[];receipts={};runtime={'ambiguous':True,'stale':False,'eligible':True};errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def mock(route):
   req=route.request;url=req.url;uid=UID
   try:uid=json.loads(base64.urlsafe_b64decode(req.headers['authorization'].split('.')[1]+'==='))['sub']
   except:pass
   payload={};status=200
   if '/auth/v1/user' in url:payload=user(uid)
   elif '/auth/v1/token' in url:payload=session(OTHER)
   elif '/rest/v1/ifund_profiles' in url:payload={'id':uid,'account_status':'active','account_deletion_pending':False}
   elif '/rest/v1/ifund_legal_acceptances' in url:payload={'owner_id':uid,'terms_version':'2026-10-13-v3','explicit_consent':True}
   elif '/api/agents/strategy/subscription' in url:payload={'active':runtime['eligible'],'level':1 if runtime['eligible'] else 0}
   elif '/api/agents/strategy/workspace' in url:payload={'brief':None,'recommendations':rows[uid]}
   elif '/api/agents/strategy/brief' in url:
    calls.append(('brief',req.post_data_json));payload={'brief':{'summary':'A saved evidence-based plan','today_priorities':['Verify facts','Clarify need'],'week_priorities':['Review','Learn'],'long_term':['Reassess','Maintain trust'],'risks':['Outcomes unknown'],'predictions':[]},'recommendations':rows[uid]}
   elif '/api/agents/strategy/bulk' in url:
    body=req.post_data_json;calls.append(('bulk',body));op=body['operation_id']
    if runtime['stale']:status=409;payload={'error':'Your selection has changed.'};runtime['stale']=False
    elif op in receipts:payload={**receipts[op],'replayed':True}
    else:
     for r in rows[uid]:
      if any(i['id']==r['id'] for i in body['items']):r.update(status=body['status'],updated_at='2026-11-04T06:01:00.654321Z')
     payload={'changed':len(body['items']),'status':body['status']};receipts[op]=payload
     if runtime['ambiguous']:status=503;payload={'error':'Response interrupted.'};runtime['ambiguous']=False
   elif '/rest/v1/' in url:payload=[]
   elif '/auth/v1/' in url:payload={}
   else:await route.abort();return
   await route.fulfill(status=status,content_type='application/json',body=json.dumps(payload),headers={'access-control-allow-origin':'*'})
  await ctx.route('https://ssibsfmtodgximseeqsv.supabase.co/**',mock);await ctx.route('**/api/agents/strategy/**',mock)
  await page.goto(ORIGIN+'/agents/strategy');await page.get_by_text('Sign in to continue',exact=True).wait_for();print('PASS signed-out member guard')
  await page.evaluate('([key,s])=>localStorage.setItem(key,JSON.stringify(s))',[KEY,session(UID)]);await page.reload()
  await page.get_by_role('checkbox',name='Select all 3 loaded').wait_for()
  await page.get_by_role('button',name='Prepare my Mission Brief',exact=True).click();await page.get_by_text('A saved evidence-based plan',exact=True).wait_for();assert len(calls)==1;print('PASS generate and show private saved Mission Brief')
  await page.get_by_role('checkbox',name='Select all 3 loaded').check();await page.get_by_role('button',name='Accept selected',exact=True).click()
  await page.get_by_role('region',name='Review selected changes').wait_for();assert not [c for c in calls if c[0]=='bulk']
  await page.get_by_role('button',name='Cancel',exact=True).click();assert not [c for c in calls if c[0]=='bulk'];print('PASS explicit selected review and cancel makes no mutation')
  await page.get_by_role('button',name='Accept selected',exact=True).click();await page.get_by_role('button',name='Confirm changes',exact=True).click();await page.get_by_role('alert').filter(has_text='Response interrupted').wait_for()
  # A new record arriving between attempts must not join the selection.
  rows[UID].append(rec(4,UID))
  await page.get_by_role('button',name='Retry same selection',exact=True).click();await page.get_by_text('3 recommendations accepted.',exact=True).wait_for()
  batches=[c[1] for c in calls if c[0]=='bulk'];assert batches[0]==batches[1];assert rows[UID][-1]['status']=='open';assert all(r['status']=='accepted' for r in rows[UID][:3]);print('PASS ambiguous response retries exact receipt; new records untouched')
  await page.get_by_role('checkbox',name='Select all 4 loaded').check();runtime['stale']=True;await page.get_by_role('button',name='Dismiss selected',exact=True).click();await page.get_by_role('button',name='Confirm changes',exact=True).click();await page.get_by_role('alert').filter(has_text='selection has changed').wait_for();assert rows[UID][-1]['status']=='open';print('PASS stale batch displays conflict without local success')
  await page.get_by_role('button',name='Reload saved plan',exact=True).click();await page.get_by_role('checkbox',name='Select all 4 loaded').wait_for();await page.get_by_role('region',name='Review selected changes').wait_for(state='hidden')
  await page.get_by_role('checkbox',name='Select all 4 loaded').check()
  second=await ctx.new_page();await second.goto(ORIGIN+'/login');await second.get_by_label('Email address').fill('b@example.invalid');await second.get_by_label('Password',exact=True).fill('Test-password-123!');await second.get_by_role('button',name='Sign in',exact=True).click()
  await page.get_by_text('PRIVATE 2222 recommendation 9',exact=True).wait_for();assert await page.get_by_text('PRIVATE 1111 recommendation 1',exact=True).count()==0;assert await page.get_by_text('0 selected',exact=True).count()==1;print('PASS account switch removes private plan, selection and pending action')
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS mobile layout without horizontal overflow')
  runtime['eligible']=False;await page.reload();await page.get_by_text('An eligible AI plan is required.',exact=False).wait_for();assert await page.get_by_role('button',name='Accept selected',exact=True).count()==0;print('PASS ineligible account cannot see batch actions')
  assert not errors,errors;await browser.close()
asyncio.run(main())
