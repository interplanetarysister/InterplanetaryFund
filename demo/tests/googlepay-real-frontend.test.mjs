// Exercises the REAL deployed Google Pay page's authored chosen() function from source.
// No PayPal calls, no browser buyer impersonation, no receipts, no database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker/googlepay-ui.js',import.meta.url),'utf8');
const match=source.match(/function chosen\(\)\{[\s\S]*?\n\}/);
assert.ok(match,'actual checkout chosen() function must exist');
const amounts=[100,250,333,500,1000,2500,101,199,299,499,999,1001,2499,2501,9999,10000,110,125,750,5555];
const campaigns=Array.from({length:5},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
function chosen(amount,campaign) {
  const fields={amount:{value:amount},campaign:{value:campaign}};
  const context={document:{getElementById:id=>fields[id]},Error,Number,BigInt};
  return vm.runInNewContext(match[0]+'; chosen()',context);
}
for(let i=0;i<amounts.length;i++)for(let j=0;j<campaigns.length;j++){
  const cents=amounts[i],amount=(cents/100).toFixed(2),campaign=campaigns[j];
  test(`real checkout parser ${i*5+j+1}/100 USD ${amount} fictional campaign ${j+1}`,()=>{
    const actual=chosen(amount,campaign);
    assert.equal(actual.cents,cents);
    assert.equal(actual.campaign,campaign);
  });
}
for(const invalid of ['','0','0.00','0.99','100.01','3.333','1.001','1e2','1,000',' 1.00','1.00 ','NaN','Infinity','01.00','$1.00','-1','1.2.3','abc','2,50','+2']){
  test(`real checkout rejects invalid amount ${JSON.stringify(invalid)}`,()=>{
    assert.throws(()=>chosen(invalid,campaigns[0]),/Choose a test amount/);
  });
}
test('real checkout rejects non-UUID campaign',()=>assert.throws(()=>chosen('3.33','real-campaign'),/fictional campaign/));
test('real checkout source requires sandbox mode and provider capture before receipt',()=>{
  assert.match(source,/environment:'TEST'/);
  assert.match(source,/config\.environment!=='sandbox'/);
  assert.match(source,/result\.status!=='captured'/);
  assert.match(source,/result\.capture_id/);
});
