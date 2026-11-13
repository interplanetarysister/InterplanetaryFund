// Isolated fake-money wallet experience. Never imports production payments.
export const googlePayPage = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Pay Sandbox | Interplanetary Fund</title>
<link rel="icon" href="/favicon.ico"><style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
body{margin:0;background:radial-gradient(ellipse at top,#18335f,#081226 68%);color:#eff6ff;min-height:100vh}
main{max-width:570px;margin:30px auto;padding:24px;border:1px solid #2c4d75;border-radius:18px;background:#101d35}
h1{margin:0;font-size:26px}.brand{font-weight:800;color:#67e8f9}
p{line-height:1.6}.notice{background:#443318;border:1px solid #946b21;border-radius:10px;padding:12px;color:#ffdea0}
label{display:block;margin:16px 0 5px;font-weight:650}select,input{width:100%;box-sizing:border-box;min-height:44px;padding:10px;border:1px solid #486383;border-radius:8px;background:#0a162c;color:white;font-size:16px}
button{min-height:44px}.amount{font-weight:800;font-size:22px}
#pay{margin-top:20px;min-height:48px}a{color:#7de4ff}
#status{min-height:26px}.danger{color:#fca5a5}.success{color:#a7f3d0}
small{color:#cbd5e1}footer{margin-top:24px;border-top:1px solid #254263;padding-top:18px}
</style></head><body>
<main><div class="brand">iFund | Interplanetary Fund</div><h1>Google Pay checkout</h1>
<p class="notice"><strong>SANDBOX ONLY — FAKE MONEY</strong><br>No real donation, payout or charge will occur. The separate sandbox ledger is used.</p>
<p>PayPal and Google Pay approval is required. Your payment appears as successful only after the sandbox provider capture and demo receipt are verified.</p>
<p id="status" role="status" aria-live="polite">Checking your demo account…</p>
<section id="form" hidden><label for="campaign">Fictional campaign</label><select id="campaign"></select>
<label for="amount">Test donation (USD, $1–$100)</label><input id="amount" type="number" min="1" max="100" step=".01" value="5.00">
<p>Test total: <span class="amount" id="total">$5.00</span></p>
<div id="pay" aria-label="Google Pay sandbox button"></div><p id="receipt" role="alert"></p></section>
<footer><a href="/hackathon">Return to the sandbox demo</a> · <a href="/api/judge-guide">Judge walkthrough</a></footer></main>
<script src="/api/google-pay.js" defer></script></body></html>`;
export const googlePayScript = String.raw`
const byId = id => document.getElementById(id);
const status = (msg,bad=false)=>{byId('status').textContent=msg;byId('status').className=bad?'danger':''};
let gateway, walletConfig, paymentsClient, busy=false, lastKey=null, lastAmount=null;
async function json(url,options){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||d.message||('HTTP '+r.status));
  return d;
}
async function script(src){
  return new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=src;el.async=true;
    el.onload=resolve;el.onerror=()=>reject(Error('Wallet SDK unavailable'));
    document.head.appendChild(el);
  });
}
function chosen(){
  const input=byId('amount').value;
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input))
    throw Error('Choose a test amount from $1 to $100 with at most two decimal places');
  const parts=input.split('.');
  const cents=Number(BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0')));
  if(!Number.isSafeInteger(cents)||cents<100||cents>10000)
    throw Error('Choose a test amount from $1 to $100');
  const campaign=byId('campaign').value;
  if(!/^[a-f0-9-]{36}$/.test(campaign))throw Error('Select a fictional campaign');
  return {campaign,cents};
}
function total(){
  const amount=Number(byId('amount').value);
  byId('total').textContent=Number.isFinite(amount)?('$'+amount.toFixed(2)):'—';
  render().catch(e=>status(e.message,true));
}
async function render(){
  if(!walletConfig||!paymentsClient)return;
  const host=byId('pay');host.replaceChildren();
  let value;
  try{value=chosen()}catch(e){status(e.message,true);return}
  const eligible=await paymentsClient.isReadyToPay({
    apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:walletConfig.allowedPaymentMethods
  });
  if(!eligible.result){status('Google Pay is unavailable on this device or sandbox merchant. Use PayPal in the demo.');return}
  const button=paymentsClient.createButton({buttonColor:'black',buttonType:'donate',onClick:()=>{
    if(busy)return;
    let current;try{current=chosen()}catch(e){status(e.message,true);return}
    byId('receipt').textContent='';
    paymentsClient.loadPaymentData({
      apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:walletConfig.allowedPaymentMethods,
      merchantInfo:walletConfig.merchantInfo,
      transactionInfo:{countryCode:walletConfig.countryCode||'US',currencyCode:'USD',
        totalPriceStatus:'FINAL',totalPrice:(current.cents/100).toFixed(2),
        totalPriceLabel:'iFund sandbox gift'},
      callbackIntents:['PAYMENT_AUTHORIZATION']
    }).catch(()=>{});
  }});
  host.replaceChildren(button);status('Google Pay sandbox checkout is ready.');
}
(async()=>{
  try{
    const account=await json('/api/session');
    if(!account.user){status('Sign in using a demo account first.');return}
    const campaigns=await json('/api/campaigns');
    const options=(campaigns.campaigns||[]).filter(c=>c.fictional===true&&c.status==='published');
    if(!options.length)throw Error('No published fictional campaigns are available');
    for(const c of options){
      const option=document.createElement('option');option.value=c.id;
      option.textContent=String(c.title||'Fictional campaign').slice(0,100);
      byId('campaign').appendChild(option);
    }
    const config=await json('/api/google-pay/config');
    if(config.environment!=='sandbox'||!config.client_id)throw Error('Sandbox wallet is not configured');
    await Promise.all([
      script('https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(config.client_id)+'&components=googlepay&currency=USD&intent=capture'),
      script('https://pay.google.com/gp/p/js/pay.js')
    ]);
    if(!window.paypal?.Googlepay||!window.google?.payments?.api)throw Error('Google Pay SDK unavailable');
    gateway=window.paypal.Googlepay();
    walletConfig=await gateway.config();
    if(!walletConfig?.allowedPaymentMethods?.length||!walletConfig?.merchantInfo)
      throw Error('This sandbox PayPal merchant is not eligible for Google Pay');
    paymentsClient=new google.payments.api.PaymentsClient({
      environment:'TEST',
      paymentDataCallbacks:{onPaymentAuthorized:async paymentData=>{
        const failure=msg=>({transactionState:'ERROR',error:{intent:'PAYMENT_AUTHORIZATION',message:msg}});
        if(busy)return failure('A wallet payment is already processing');
        busy=true;
        let approved=false;
        try{
          const {campaign,cents}=chosen();
          const requestKey=campaign+'|'+cents;
          if(requestKey!==lastAmount){lastKey=crypto.randomUUID();lastAmount=requestKey}
          status('Creating a sandbox order…');
          const order=await json('/api/paypal/orders',{method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({key:lastKey,purpose:'campaign',campaign_id:campaign,amount_cents:cents,checkout_method:'googlepay'})});
          if(!order.id||!order.paypal_order_id)throw Error('Sandbox order was not issued');
          const confirmation=await gateway.confirmOrder({orderId:order.paypal_order_id,
            paymentMethodData:paymentData.paymentMethodData});
          if(confirmation?.status==='PAYER_ACTION_REQUIRED'){
            await gateway.initiatePayerAction({orderId:order.paypal_order_id});
          }else if(confirmation?.status!=='APPROVED')throw Error('Wallet authorization was not approved');
          approved=true;
          status('Verifying PayPal sandbox capture and ledger…');
          const result=await json('/api/paypal/orders/'+encodeURIComponent(order.id)+'/capture',{
            method:'POST',headers:{'content-type':'application/json'},body:'{}'
          });
          if(result.status!=='captured'||!result.capture_id)
            throw Error('Capture was not verified. Check sandbox receipt before trying again');
          byId('receipt').textContent='Sandbox capture verified: '+result.capture_id;
          byId('receipt').className='success';
          status('Fake-money donation recorded in the isolated sandbox ledger.');
          return {transactionState:'SUCCESS'};
        }catch(e){
          status(approved?'Payment authorization may have succeeded. Check sandbox receipt before retrying.':e.message,true);
          return failure('Payment not verified. Check sandbox receipt before trying again');
        }finally{busy=false}
      }}
    });
    byId('form').hidden=false;
    byId('amount').addEventListener('change',total);
    byId('campaign').addEventListener('change',()=>{render().catch(e=>status(e.message,true))});
    await render();
  }catch(e){status(e.message,true)}
})();
`;
