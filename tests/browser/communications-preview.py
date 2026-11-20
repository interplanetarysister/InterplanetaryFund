# Mocked UI acceptance: no real account, consent or campaign writes.
import asyncio,base64,json,time
from playwright.async_api import async_playwright
UID='11111111-1111-4111-8111-111111111111';OTHER='22222222-2222-4222-8222-222222222222';ORIGIN='http://localhost:4282';KEY='sb-ssibsfmtodgximseeqsv-auth-token'
def user(uid):return {'id':uid,'aud':'authenticated','role':'authenticated','email':'test@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}
def session(uid):
 enc=lambda o:base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
 token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'exp':int(time.time())+3600,'aud':'authenticated','role':'authenticated'})+'.mock'
 return {'access_token':token,'refresh_token':'mock-'+uid,'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user(uid)}
def rec(i,uid):return {'id':f'aaaaaaaa-aaaa-4aaa-8aaa-{i:012d}','title':f'PRIVATE {uid[-4:]} recommendation {i}','campaign_title':'My campaign','description':'Explain the actual need','reasoning':'Use verified facts','evidence':'School supplies','confidence':'medium','expected_impact':'May improve understanding','estimated_effort':'One hour','status':'open','updated_at':'2026-11-04T06:00:00.123456Z'}
from urllib.parse import urlparse,parse_qs
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=await browser.new_context(viewport={'width':390,'height':844});page=await ctx.new_page();page.set_default_timeout(12000)
  rows={UID:[],OTHER:[{'id':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','campaign_id':OTHER,'campaign_title':'Other campaign','subject':'PRIVATE B MESSAGE','content':'Private B content','comm_type':'update','status':'draft','updated_at':'2026-11-04T06:00:00.123456Z'}]};prefs={UID:{'email_updates':True,'in_app_updates':True},OTHER:{'email_updates':True,'in_app_updates':True}}
  runtime={'delivery':False,'ai':False,'ambiguous_send':True,'stale':False,'delay_pref':False};calls=[];receipts={};previews={};errors=[];pref_started=asyncio.Event();pref_release=asyncio.Event()
  page.on('pageerror',lambda e:errors.append(str(e)))
  def revision_now():return '2026-11-04T06:01:00.654321Z'
  async def mock(route):
   req=route.request;url=req.url;uid=UID;status=200;payload={}
   try:uid=json.loads(base64.urlsafe_b64decode(req.headers['authorization'].split('.')[1]+'==='))['sub']
   except:pass
   if '/auth/v1/user' in url:payload=user(uid)
   elif '/auth/v1/token' in url:payload=session(OTHER)
   elif '/rest/v1/ifund_profiles' in url:
    query=parse_qs(urlparse(url).query)
    if req.method=='PATCH':
     expected=json.loads(query['comm_prefs'][0].removeprefix('eq.'));body=req.post_data_json
     if expected!=prefs[uid]:payload=None
     else:prefs[uid]=body['comm_prefs'];payload={'id':uid,'comm_prefs':prefs[uid]}
    else:
     payload={'id':uid,'account_status':'active','account_deletion_pending':False,'display_name':'A member','handle':'member','comm_prefs':dict(prefs[uid])}
     if query.get('select')==['id,comm_prefs'] and runtime.pop('delay_pref',False):pref_started.set();await pref_release.wait()
   elif '/rest/v1/ifund_legal_acceptances' in url:payload={'owner_id':uid,'terms_version':'2026-10-13-v3','explicit_consent':True}
   elif '/rest/v1/ifund_notifications' in url:payload=[{'id':uid,'owner_id':uid,'title':'A supporter update','body':'Q'*4000,'type':'update','link':'/campaign/'+uid,'read':False,'created_at':'2026-11-04T06:00:00Z'}]
   elif '/api/agents/communications/workspace' in url:payload={'campaigns':[{'id':uid,'title':'My campaign'}],'messages':rows[uid],'ai_available':runtime['ai'],'delivery_available':runtime['delivery'],'email_available':False}
   elif '/api/agents/communications/save' in url:
    b=req.post_data_json;calls.append(('save',b));op=b['operation_id']
    if op in receipts:payload=receipts[op]
    else:
     m={'id':b['message_id'] or 'aaaaaaaa-aaaa-4aaa-8aaa-'+f'{len(rows[uid])+1:012d}','campaign_id':b['campaign_id'],'campaign_title':'My campaign','subject':b['subject'],'content':b['content'],'comm_type':b['comm_type'],'status':'draft','updated_at':revision_now()}
     rows[uid]=[m]+[x for x in rows[uid] if x['id']!=m['id']];payload={'message':m,'replayed':False};receipts[op]=payload
   elif '/api/agents/communications/drafts' in url:
    b=req.post_data_json;calls.append(('ai',b));m={'id':'cccccccc-cccc-4ccc-8ccc-cccccccccccc','campaign_id':uid,'campaign_title':'My campaign','subject':'AI thank-you draft','content':'Thanks for encouraging this campaign.','comm_type':'thank_you','status':'draft','updated_at':revision_now()};rows[uid]=[m]+rows[uid];payload={'message':m,'replayed':False}
   elif '/api/agents/communications/prepare-send' in url:
    b=req.post_data_json;calls.append(('prepare',b));preview_id=b['preview_id'];items=[dict(x,eligible_recipients=0 if 'Zero' in x['subject'] else 1) for x in rows[uid] if any(i['id']==x['id'] for i in b['items'])];payload={'preview_id':preview_id,'messages':items,'expires_at':'2026-11-04T06:10:00Z'};previews[preview_id]=payload
   elif '/api/agents/communications/send' in url:
    b=req.post_data_json;calls.append(('send',b));op=b['preview_id'];assert b=={'preview_id':op,'confirm_owner_review':True}
    if runtime['stale']:status=409;payload={'error':'Your saved messages or review have changed. Reload before choosing again.'};runtime['stale']=False
    elif op in receipts:payload={**receipts[op],'replayed':True}
    else:
     outcomes=[]
     for m in previews[op]['messages']:
      count=m['eligible_recipients'];outcomes.append({'id':m['id'],'status':'sent_in_app' if count else 'no_eligible_supporters','delivered':count,'excluded_since_review':0})
      if count:
       for row in rows[uid]:
        if row['id']==m['id']:row.update(status='sent',updated_at=revision_now())
     payload={'outcomes':outcomes,'messages_attempted':len(outcomes),'replayed':False};receipts[op]=payload
     if runtime['ambiguous_send']:status=503;payload={'error':'Delivery response interrupted.'};runtime['ambiguous_send']=False
   elif '/api/agents/communications/cancel' in url:
    b=req.post_data_json;calls.append(('cancel',b))
    for row in rows[uid]:
     if any(i['id']==row['id'] for i in b['items']):row['status']='cancelled'
    payload={'cancelled':len(b['items']),'replayed':False}
   elif '/rest/v1/' in url:payload=[]
   elif '/auth/v1/' in url:payload={}
   else:await route.abort();return
   await route.fulfill(status=status,content_type='application/json',body=json.dumps(payload),headers={'access-control-allow-origin':'*'})
  await ctx.route('https://ssibsfmtodgximseeqsv.supabase.co/**',mock);await ctx.route('**/api/agents/communications/**',mock)
  await page.goto(ORIGIN+'/communications');await page.get_by_text('Sign in to continue',exact=True).wait_for();print('PASS communications account guard')
  await page.evaluate('([k,s])=>localStorage.setItem(k,JSON.stringify(s))',[KEY,session(UID)]);await page.reload()
  await page.get_by_label('Campaign',exact=True).select_option(UID);await page.get_by_label('Subject',exact=True).fill('PRIVATE A update');await page.get_by_label('Message',exact=True).fill('The supplies list is ready for owner review.');await page.get_by_role('button',name='Save draft',exact=True).click();await page.get_by_text('Your draft is saved. Review it before sending.',exact=True).wait_for();assert len([c for c in calls if c[0]=='save'])==1;assert not [c for c in calls if c[0]=='send'];print('PASS free manual draft saved without AI or sending')
  await page.get_by_role('checkbox',name='Select 1 loaded drafts').check();await page.get_by_role('button',name='Review for sending',exact=True).click();await page.get_by_role('region',name='Owner message review').wait_for();assert await page.get_by_role('button',name='Send these updates in IFund',exact=True).is_disabled();assert not [c for c in calls if c[0]=='send'];print('PASS preview exact-text review with delivery disabled')
  await page.get_by_role('button',name='Back to drafts',exact=True).click();runtime['delivery']=True;await page.get_by_role('button',name='Reload saved messages',exact=True).click();await page.get_by_role('checkbox',name='Select 1 loaded drafts').wait_for();await page.get_by_role('checkbox',name='Select 1 loaded drafts').check();await page.get_by_role('button',name='Review for sending',exact=True).click();await page.get_by_role('region',name='Owner message review').get_by_text('The supplies list is ready for owner review.',exact=True).wait_for();await page.get_by_role('button',name='Send these updates in IFund',exact=True).click();await page.get_by_role('alert').filter(has_text='Delivery response interrupted').wait_for()
  rows[UID].insert(0,{'id':'dddddddd-dddd-4ddd-8ddd-dddddddddddd','campaign_id':UID,'campaign_title':'My campaign','subject':'New arrival','content':'This draft arrived later.','comm_type':'update','status':'draft','updated_at':revision_now()})
  await page.get_by_role('button',name='Retry same request',exact=True).click();await page.get_by_text('PRIVATE A update: sent inside IFund to 1 supporter.',exact=True).wait_for();sends=[c[1] for c in calls if c[0]=='send'];assert sends[0]==sends[1];assert rows[UID][0]['status']=='draft';print('PASS explicit send, ambiguous receipt retry and new draft exclusion')
  await page.get_by_role('checkbox',name='Select New arrival',exact=True).check();await page.get_by_role('button',name='Review for sending',exact=True).click();runtime['stale']=True;await page.get_by_role('button',name='Send these updates in IFund',exact=True).click();await page.get_by_role('alert').filter(has_text='review have changed').wait_for();assert rows[UID][0]['status']=='draft';assert await page.get_by_text('PRIVATE A update: sent inside IFund to 1 supporter.',exact=True).count()==0;print('PASS stale review shows no false current success')
  await page.get_by_role('button',name='Reload saved messages',exact=True).click();await page.get_by_role('region',name='Owner message review').wait_for(state='hidden');await page.get_by_role('checkbox',name='Select New arrival',exact=True).check();await page.get_by_role('button',name='Cancel selected drafts',exact=True).click();assert not [c for c in calls if c[0]=='cancel'];await page.get_by_role('button',name='Confirm cancellation',exact=True).click();await page.get_by_text('1 draft cancelled.',exact=True).wait_for();assert rows[UID][0]['status']=='cancelled';print('PASS bulk cancellation requires explicit review')
  runtime['ai']=True;await page.get_by_role('button',name='Reload saved messages',exact=True).click();await page.get_by_label('What should your supporters know?',exact=True).wait_for();await page.get_by_label('Campaign',exact=True).select_option(UID);await page.get_by_label('What should your supporters know?',exact=True).fill('Thank the supporters for their encouragement.');await page.get_by_role('button',name='Prepare a message draft',exact=True).click();await page.get_by_text('Your AI-assisted draft is saved for review. It has not been sent.',exact=True).wait_for();assert rows[UID][0]['status']=='draft';print('PASS AI prepares an unsent review draft')
  await page.get_by_label('Subject',exact=True).fill('PRIVATE UNSENT OWNER A');await page.get_by_role('checkbox',name='Select AI thank-you draft',exact=True).check()
  second=await ctx.new_page();await second.goto(ORIGIN+'/login');await second.get_by_label('Email address').fill('b@example.invalid');await second.get_by_label('Password',exact=True).fill('Test-password-123!');await second.get_by_role('button',name='Sign in',exact=True).click();await page.get_by_role('heading',name='PRIVATE B MESSAGE',exact=True).wait_for();assert await page.get_by_label('Subject',exact=True).input_value()=='';assert await page.get_by_text('0 selected',exact=True).count()==1;assert await page.get_by_role('heading',name='AI thank-you draft',exact=True).count()==0;assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS account switch clears private messages/form/review; mobile fits')
  runtime['delay_pref']=True;await page.goto(ORIGIN+'/profile');await asyncio.wait_for(pref_started.wait(),10);await page.get_by_role('button',name='Reload update preferences',exact=True).click();await page.get_by_label('Receive campaign updates inside IFund',exact=True).uncheck();await page.get_by_role('button',name='Save update preferences',exact=True).click();await page.get_by_text('Your supporter update preferences are saved.',exact=True).wait_for();pref_release.set();await page.wait_for_timeout(200);assert not await page.get_by_label('Receive campaign updates inside IFund',exact=True).is_checked();assert prefs[OTHER]['in_app_updates'] is False;print('PASS delayed initial preference GET cannot undo confirmed opt-out')
  # A concurrent saved change must reject this tab's stale preference snapshot.
  prefs[OTHER]['email_updates']=False;await page.get_by_label('Receive campaign updates inside IFund',exact=True).check();await page.get_by_role('button',name='Save update preferences',exact=True).click();await page.get_by_role('alert').filter(has_text='preferences changed').wait_for();assert prefs[OTHER]['in_app_updates'] is False;await page.get_by_role('button',name='Reload update preferences',exact=True).click();await page.wait_for_timeout(100);assert not await page.get_by_label('Receive campaign updates inside IFund',exact=True).is_checked();print('PASS stale preference save cannot resurrect opt-in')
  await page.goto(ORIGIN+'/notifications');await page.get_by_text('Q'*4000,exact=True).wait_for();assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS full 4000-character notification is readable without mobile overflow')
  assert not errors,errors;await browser.close()
asyncio.run(main())
