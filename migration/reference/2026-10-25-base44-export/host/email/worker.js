import PostalMime from 'postal-mime';

// Cloudflare email catch-all, separate from website Worker.
// A verified Gmail destination preserves message delivery while the
// Base44 inbox mirror is authenticated and tested.
const encoder=new TextEncoder();
const fromB64=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const trim=(value,length)=>String(value||'').slice(0,length);
const validRecipient=to=>/^[^\s@<>\u0000-\u001f]{1,64}@(mail\.)?interplanetaryfund\.com$/.test(to);
async function sign(secret,stamp,body) {
  const key=await crypto.subtle.importKey('pkcs8',fromB64(secret),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  return hex(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(stamp+'.'+body)));
}
export default {
  async email(message,env) {
    const to=String(message.to||'').trim().toLowerCase();
    if(!validRecipient(to)) {message.setReject('Unknown mailbox');return;}
    let payload=null;
    // Oversized and non-parseable emails are still forwarded to the verified
    // owner; only the text mirror has a 2 MB input and 12k character limit.
    if(Number(message.rawSize||0)<=2_000_000){
      try{
        const raw=new Uint8Array(await new Response(message.raw).arrayBuffer());
        if(raw.byteLength<=2_000_000){
          const parsed=await PostalMime.parse(raw);
          const fallback=hex(await crypto.subtle.digest('SHA-256',raw));
          payload={
            message_id:trim(message.headers?.get('message-id')||fallback,254),
            from:trim(message.from,254),to,
            subject:trim(parsed.subject,240),text:trim(parsed.text,12000)
          };
        }
      }catch(e){console.error('Email parsing skipped',e?.name||'Error');}
    }
    const isVerification=to.endsWith('@interplanetaryfund.com') && to.startsWith('verify-');
    // Explicit IFund-operated mailboxes only. Never forward customer mail to the owner.
    // Root-domain mail belongs to IFund; paid member mail uses its own subdomain.
    const isAdmin=to.endsWith('@interplanetaryfund.com') && !isVerification;
    const isMember=to.endsWith('@mail.interplanetaryfund.com');
    if(isVerification && !/^verify-[a-f0-9]{32}@interplanetaryfund\.com$/.test(to)) {
      message.setReject('Unknown verification mailbox'); return;
    }
    // NEVER forward another user's verification/security emails to the admin.
    // Ordinary organization mail retains its established Gmail forwarding route.
    if(isAdmin) await message.forward('cuddlemeplatonically@gmail.com');
    // For member addresses, an authenticated private member-ingress service
    // MUST first verify the recipient has an active paid mailbox. No fallback
    // to Gmail, Base44's admin InboxItem, or internal platform notifications.
    if(isMember) {
      if(!payload){message.setReject('Mailbox delivery unavailable');return;}
      const memberEndpoint=String(env.IFUND_MEMBER_EMAIL_RECEIVER_URL||'');
      const memberSigningKey=String(env.IFUND_EMAIL_SIGNING_PRIVATE_KEY||'');
      if(!memberEndpoint.startsWith('https://')||!memberSigningKey) {
        message.setReject('Member inbox not activated');return;
      }
      try {
        const body=JSON.stringify(payload);
        const stamp=String(Math.floor(Date.now()/1000));
        const signature=await sign(memberSigningKey,stamp,body);
        const response=await fetch(memberEndpoint,{
          method:'POST',redirect:'error',
          headers:{'content-type':'application/json','x-ifund-email-timestamp':stamp,'x-ifund-email-signature':signature},
          body
        });
        if(!response.ok){message.setReject('Member mailbox unavailable');return;}
        return;
      }catch(err){console.error('Member email delivery failed',err?.name||'Error');message.setReject('Member mailbox unavailable');return;}
    }
    if(!payload) {
      if(isVerification) message.setReject('Verification email cannot be received');
      return;
    }
    // Organization messages go to independent Supabase; verification stays on its isolated handler.
    const endpoint=String((isAdmin?env.IFUND_ADMIN_EMAIL_RECEIVER_URL:env.IFUND_EMAIL_RECEIVER_URL)||'');
    const secret=String(env.IFUND_EMAIL_SIGNING_PRIVATE_KEY||'');
    if(!endpoint.startsWith('https://')||!secret) {console.error('Inbox mirror not configured');if(isVerification)message.setReject('Verification inbox unavailable');return;}
    try{
      const body=JSON.stringify(payload);
      const stamp=String(Math.floor(Date.now()/1000));
      const signature=await sign(secret,stamp,body);
      const response=await fetch(endpoint,{
        method:'POST',redirect:'error',
        headers:{'content-type':'application/json','x-ifund-email-timestamp':stamp,'x-ifund-email-signature':signature},
        body
      });
      if(!response.ok) {console.error('IFund inbox mirror rejected: HTTP '+response.status);if(isVerification)message.setReject('Verification mailbox unavailable');}
    }catch(err){console.error('IFund inbox mirror error',err?.name||'Error');if(isVerification) message.setReject('Verification mailbox unavailable');}
  }
};
