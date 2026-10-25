import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../base44/shared/paypal.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function paypalModule(makePage) {
  const seen = [];
  const exports = {};
  const fakeFetch = async (resource, args = {}) => {
    const url = new URL(resource);
    const api = url.pathname;
    seen.push({ api, page: url.searchParams.get('page'), start: url.searchParams.get('start_date'), end: url.searchParams.get('end_date'), method: args.method || 'GET' });
    if (api.endsWith('/v1/oauth2/token')) return {ok:true,json:async()=>({access_token:'mock-test-token'})};
    assert.equal(api,'/v1/reporting/transactions');
    assert.equal(args.method, undefined);
    assert.equal(url.searchParams.get('fields'),'all');
    const result = makePage({
      page:Number(url.searchParams.get('page')),
      start:url.searchParams.get('start_date'),
      end:url.searchParams.get('end_date'),
      size:Number(url.searchParams.get('page_size')),
    });
    return {ok:result.ok !== false,status:result.status || 200,json:async()=>result.body};
  };
  new Function('require','exports','fetch','btoa','Response','console',js)(
    name => {
      if(name === 'base44:runtime')return {secrets:{get:(key)=>({
        PAYPAL_MODE:'live',PAYPAL_CLIENT_ID:'fake',PAYPAL_CLIENT_SECRET:'fake',
      }[key]||null)}};
      throw new Error('Unanticipated import '+name);
    },exports,fakeFetch,btoa,Response,console,
  );
  return {listTransactions:exports.listTransactions,seen};
}
const row = (id,day='2026-10-08') => ({transaction_info:{
  transaction_id:id, transaction_status:'S',transaction_event_code:'T0013',
  transaction_amount:{value:'12.50',currency_code:'USD'},
  fee_amount:{value:'-0.75',currency_code:'USD'},
  transaction_updated_date:day+'T12:00:00Z',
}});
const start = '2026-08-09T00:00:00Z';
const end = '2026-10-08T00:00:00Z';

{
  const {listTransactions,seen}=paypalModule(({page,start})=>{
    return {body:{
      total_pages:2,
      transaction_details:page === 1 ? [row('shared'), row('first'+start)] : [row('shared'), row('last'+start)],
    }};
  });
  const entries=await listTransactions({startDate:start,endDate:end,pageSize:2});
  const reportCalls=seen.filter(x=>x.api.includes('/reporting/'));
  assert.equal(reportCalls.length,4,'Every time window must check every provider-reported page');
  assert.equal(new Set(reportCalls.map(x=>x.start)).size,2,'60 days requires two bounded windows');
  assert.equal(new Set(entries.map(x=>x.id)).size,entries.length,'No duplicate PayPal IDs');
  assert.equal(entries.length,5);
  assert.ok(entries.every(x=>x.feeAmount === .75));
  for(const entry of reportCalls){
    assert.ok((Date.parse(entry.end)-Date.parse(entry.start)) <= 30*24*60*60*1000);
  }
  assert.equal(seen.filter(x=>x.method==='POST').length,1,'Only token grant POST allowed; no charges/captures');
}
{
  let windows=0;
  const {listTransactions}=paypalModule(({page,start})=>{
    assert.equal(page,1);
    windows++;
    return {body:{total_pages:1,transaction_details:[row('a'+start)]}};
  });
  const entries=await listTransactions({startDate:'2026-07-10T00:00:00Z',endDate:end});
  assert.equal(windows,3,'90 day scan must make three PayPal-safe windows');
  assert.equal(entries.length,3);
}
{
  const {listTransactions}=paypalModule(()=>({body:{total_pages:1,transaction_details:null}}));
  await assert.rejects(listTransactions({startDate:'2026-10-07T00:00:00Z',endDate:end}),/invalid page/);
}
{
  const {listTransactions}=paypalModule(()=>({body:{total_pages:50,transaction_details:[row('same')]}}));
  await assert.rejects(listTransactions({startDate:'2026-10-07T00:00:00Z',endDate:end,pageSize:1}),/safe page limit/);
}
{
  const {listTransactions}=paypalModule(()=>({body:{total_pages:1,transaction_details:[]}}));
  await assert.rejects(listTransactions({startDate:'2026-06-01T00:00:00Z',endDate:end}),/at most 90 days/);
}
const panel=fs.readFileSync(new URL('../src/components/admin/PayPalReceiptRecoveryPanel.jsx',import.meta.url),'utf8');
assert.match(panel,/data\.ok !== true \|\| !Array\.isArray\(data\.receipts\)/,'Failed receipts do not masquerade as empty');
assert.match(panel,/setScannedCount/);
assert.match(panel,/option value=\{90\}/);
assert.match(panel,/scan did not complete/i);
const backend=fs.readFileSync(new URL('../base44/functions/listUntrackedPayPalReceipts/entry.ts',import.meta.url),'utf8');
assert.match(backend,/checked_transactions: transactions\.length/);
assert.match(backend,/other_settled_payment_count: otherSettledPaymentCount/);
assert.match(panel,/otherSettledPayments > 0/);
console.log('PASS: PayPal reports across 30/60/90-day windows, all pages, deduplication, no money writes, scanner error truth.');
