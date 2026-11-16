import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const I='33333333-3333-4333-8333-333333333333', J='44444444-4444-4444-8444-444444444444';
const path=new URL('../supabase/migrations/20261116034738_ifund_atomic_subscription_accounting.sql',import.meta.url);
const at='2026-11-15T12:00:00.000Z';
const event=(overrides={})=>({kind:'payment',intent_id:I,member_id:A,subscription_id:'I-SYNTHETIC0001',
 plan_id:'P-123456789012345678901234',custom_id:'IFUND-synthetic-A',merchant_id:'MERCHANT12345',
 resource_id:'SALE1234567',event_id:'WH-SYNTHETIC-0001',amount_cents:1200,currency:'USD',environment:'live',
 occurred_at:at,provider_status:'ACTIVE',status_at:'2026-11-14T12:00:00.000Z',...overrides});
const refund=(overrides={})=>event({kind:'refund',resource_id:'REFUND12345',parent_resource_id:'SALE1234567',
 event_id:'WH-REFUND-0001',amount_cents:300,occurred_at:'2026-11-15T13:00:00.000Z',...overrides});
async function fixture({enabled=true,legacy=false}={}) {
 const db=new PGlite();
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table auth.users(id uuid primary key);grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 insert into auth.users values('${A}'),('${B}');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261112150500_ifund_live_paypal_subscriptions.sql',import.meta.url),'utf8'));
 await db.exec(`insert into public.ifund_subscription_intents(id,member_id,tier,interval,amount_cents,currency,paypal_plan_id,custom_id,paypal_subscription_id,created_at)
 values('${I}','${A}','basic','monthly',1200,'USD','P-123456789012345678901234','IFUND-synthetic-A','I-SYNTHETIC0001','2026-11-14T00:00:00Z'),
 ('${J}','${B}','basic','monthly',1200,'USD','P-123456789012345678901234','IFUND-synthetic-B','I-SYNTHETIC0002','2026-11-14T00:00:00Z');`);
 if(legacy)await db.query(`insert into public.ifund_subscription_ledger(operation_key,intent_id,member_id,paypal_subscription_id,provider_reference,entry_type,amount_cents,currency,environment,provider_occurred_at)
 values($1,$2,$3,$4,'SALE1234567','payment',1200,'USD','live',$5)`,['paypal:subscription:payment:I-SYNTHETIC0001:'+at,I,A,'I-SYNTHETIC0001',at]);
 await db.exec(readFileSync(path,'utf8'));
 if(enabled)await db.exec(`update ifund_subscription_runtime.control set enabled=true,verified_merchant_id='MERCHANT12345'`);
 return db;
}
async function apply(db,e){return db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query('select public.ifund_apply_verified_subscription_event($1::jsonb) as result',[JSON.stringify(e)])).rows[0].result;});}
const rows=async db=>(await db.query('select * from public.ifund_subscription_ledger order by created_at,id')).rows;
const state=async db=>(await db.query('select status,last_state_event_at,last_payment_at,last_reversal_at from public.ifund_subscription_intents where id=$1',[I])).rows[0];

test('atomic accounting applies on canonical schema and stays disabled until separately enabled',async()=>{
 const db=await fixture({enabled:false});
 try {await assert.rejects(apply(db,event()),/not ready/);assert.equal((await rows(db)).length,0);}finally{await db.close();}
});
test('verified payment is one ledger row and one transactional state change across delivery IDs',async()=>{
 const db=await fixture();try{
  assert.equal((await apply(db,event())).duplicate,false);
  assert.equal((await apply(db,event())).duplicate,true);
  assert.equal((await apply(db,event({event_id:'WH-SYNTHETIC-0002'}))).duplicate,true);
  assert.equal((await rows(db)).length,1);assert.equal((await state(db)).status,'active');
 }finally{await db.close();}
});
test('partial refund ceilings are enforced independently for their immutable parent sale',async()=>{
 const db=await fixture();try{
  await apply(db,event());await apply(db,refund({amount_cents:700}));
  await assert.rejects(apply(db,refund({resource_id:'REFUND99999',event_id:'WH-REFUND-0002',amount_cents:501})),/remainder/);
  assert.equal((await rows(db)).length,2);
  await apply(db,refund({resource_id:'REFUND99999',event_id:'WH-REFUND-0002',amount_cents:500}));
  assert.equal((await rows(db)).reduce((sum,r)=>sum+Number(r.amount_cents),0),0);
 }finally{await db.close();}
});
test('concurrently submitted economic duplicates remain exactly one positive ledger entry',async()=>{
 const db=await fixture();try{
  const results=await Promise.all([apply(db,event()),apply(db,event({event_id:'WH-SYNTHETIC-0002'}))]);
  assert.equal(results.filter(r=>r.duplicate).length,1);assert.equal((await rows(db)).length,1);
 }finally{await db.close();}
});
test('concurrent refund submissions cannot exceed the parent capture ceiling',async()=>{
 const db=await fixture();try{
  await apply(db,event());
  const results=await Promise.allSettled([apply(db,refund({amount_cents:800})),apply(db,refund({resource_id:'REFUND99999',event_id:'WH-REFUND-0002',amount_cents:800}))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await rows(db)).length,2);
 }finally{await db.close();}
});
test('cross-owner, merchant, environment, currency, amount and immutable replay changes fail atomically',async()=>{
 const db=await fixture();try{
  await apply(db,event());
  for(const changes of [{member_id:B},{merchant_id:'OTHER1234567'},{environment:'sandbox'},{currency:'EUR'},
   {amount_cents:1201},{occurred_at:'2026-11-15T12:00:01Z'},{resource_id:'OTHER1234567'},
   {intent_id:J,member_id:B,subscription_id:'I-SYNTHETIC0002',custom_id:'IFUND-synthetic-B'}]) {
    await assert.rejects(apply(db,event(changes)),JSON.stringify(changes));
    assert.equal((await rows(db)).length,1);
   }
 }finally{await db.close();}
});
test('historical timestamp-key receipt is reused without changing the row or creating a second charge',async()=>{
 const db=await fixture({legacy:true});try{
  const before=await rows(db);
  assert.equal((await apply(db,event())).duplicate,true);
  assert.deepEqual(await rows(db),before);
 }finally{await db.close();}
});
test('historical missing provider evidence is never guessed or silently backfilled',async()=>{
 const db=await fixture({legacy:true});try{
  await db.exec('update public.ifund_subscription_ledger set provider_reference=null');
  await assert.rejects(apply(db,event()),/historical evidence incomplete/);
  const ledger=await rows(db);assert.equal(ledger.length,1);assert.equal(ledger[0].provider_reference,null);
 }finally{await db.close();}
});
test('older and equal-time lower-priority events cannot undo a later refund',async()=>{
 const db=await fixture();try{
  await apply(db,event());await apply(db,refund());
  await apply(db,event({kind:'status',resource_id:null,event_id:null,amount_cents:null,status_at:at}));
  assert.equal((await state(db)).status,'past_due');
  await apply(db,event({resource_id:'SALE9999999',event_id:'WH-SYNTHETIC-0002',occurred_at:'2026-11-15T13:00:00Z'}));
  assert.equal((await state(db)).status,'past_due');
  await apply(db,event({resource_id:'SALE8888888',event_id:'WH-SYNTHETIC-0003',occurred_at:'2026-11-15T14:00:00Z'}));
  assert.equal((await state(db)).status,'active');
 }finally{await db.close();}
});
test('late event-journal constraint failure rolls back both ledger and state',async()=>{
 const db=await fixture();try{
  await db.exec(`alter table public.ifund_subscription_events add constraint reject_test_receipt check(paypal_event_id<>'WH-SYNTHETIC-0001')`);
  await assert.rejects(apply(db,event()),/reject_test_receipt/);
  assert.equal((await rows(db)).length,0);assert.equal((await state(db)).status,'initiated');
 }finally{await db.close();}
});
test('browser roles cannot execute accounting RPCs, write ledgers or see another owner receipts',async()=>{
 const db=await fixture();try{
  await apply(db,event());
  for(const role of ['anon','authenticated'])await db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await assert.rejects(tx.query('select public.ifund_subscription_atomic_readiness()'),/permission denied/);
  });
  await db.transaction(async tx=>{
   await tx.exec(`set local role authenticated;select set_config('test.uid','${B}',true)`);
   assert.equal((await tx.query('select * from public.ifund_subscription_ledger')).rows.length,0);
  });
  await db.transaction(async tx=>{
   await tx.exec(`set local role authenticated;select set_config('test.uid','${A}',true)`);
   assert.equal((await tx.query('select * from public.ifund_subscription_ledger')).rows.length,1);
  });
 }finally{await db.close();}
});

test('a second parent sale cannot subsidize an excessive refund of the first sale',async()=>{
 const db=await fixture();try{
  await apply(db,event());
  await apply(db,event({resource_id:'SALE9999999',event_id:'WH-SYNTHETIC-0002',occurred_at:'2026-11-15T14:00:00Z'}));
  await apply(db,refund({amount_cents:1000}));
  await assert.rejects(apply(db,refund({resource_id:'REFUND99999',event_id:'WH-REFUND-0002',amount_cents:201})),/remainder/);
  assert.equal((await rows(db)).reduce((sum,r)=>sum+Number(r.amount_cents),0),1400);
 }finally{await db.close();}
});
test('cross-intent concurrent reuse of a provider resource is rejected without a second charge',async()=>{
 const db=await fixture();try{
  const other=event({intent_id:J,member_id:B,subscription_id:'I-SYNTHETIC0002',custom_id:'IFUND-synthetic-B',event_id:'WH-SYNTHETIC-0002'});
  const results=await Promise.allSettled([apply(db,event()),apply(db,other)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await rows(db)).length,1);
 }finally{await db.close();}
});
test('failed final state mutation rolls back both the economic ledger and provider event receipt',async()=>{
 const db=await fixture();try{
  await db.exec(`create function public.reject_fixture_state() returns trigger language plpgsql as $$begin raise exception 'state receipt unavailable';end$$;
    create trigger reject_fixture before update on public.ifund_subscription_intents for each row execute function public.reject_fixture_state();`);
  await assert.rejects(apply(db,event()),/state receipt unavailable/);
  assert.equal((await rows(db)).length,0);
  assert.equal((await db.query('select count(*)::int as n from public.ifund_subscription_events')).rows[0].n,0);
  assert.equal((await state(db)).status,'initiated');
 }finally{await db.close();}
});
test('owner browser roles cannot execute the economic RPC or write financial rows directly',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']) {
   await db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await assert.rejects(tx.query('select public.ifund_apply_verified_subscription_event($1::jsonb)',[JSON.stringify(event())]),/permission denied/);
   });
   await db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await assert.rejects(tx.query('update public.ifund_subscription_intents set status=\'active\' where id=$1',[I]),/permission denied/);
   });
  }
 }finally{await db.close();}
});

test('a later sale with a stale ACTIVE snapshot cannot reactivate a verified canceled subscription',async()=>{
 const db=await fixture();try{
  await apply(db,event());
  await apply(db,event({kind:'status',resource_id:null,event_id:null,amount_cents:null,provider_status:'CANCELLED',status_at:'2026-11-15T13:00:00Z'}));
  assert.equal((await state(db)).status,'canceled');
  await apply(db,event({resource_id:'SALE9999999',event_id:'WH-SYNTHETIC-0002',occurred_at:'2026-11-15T14:00:00Z'}));
  assert.equal((await rows(db)).length,2,'the actual receipt is retained');
  assert.equal((await state(db)).status,'canceled','stale entitlement snapshot cannot revive billing');
 }finally{await db.close();}
});
