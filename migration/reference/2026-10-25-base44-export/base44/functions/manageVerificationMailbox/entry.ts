import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { openMail } from '../../shared/verificationEmailCrypto.ts';
// Verification mail is never returned by the general inbox or agent tools.
export default async function(req: Request) {
 try {
   if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
   const api = createClientFromRequest(req);
   const guard = await assertActiveAccount(api);
   if (!guard.ok) return Response.json({error:guard.error},{status:guard.status});
   const userId = guard.user.id;
   const body = await req.json().catch(()=>({}));
   const mode = String(body.mode || 'list');
   if (mode === 'create') {
     const platform = String(body.platform || 'general').toLowerCase();
     if (!/^[a-z0-9_]{2,40}$/.test(platform)) return Response.json({error:'Invalid platform'},{status:400});
     const mine = await api.entities.VerificationMailbox.filter({user_id:userId});
     const existing = mine.find((row:any)=>row.platform===platform && row.status!=='disabled');
     if (existing) return Response.json({ok:true,mailbox:{address:existing.address,platform:existing.platform,status:existing.status}});
     if (mine.length>=100) return Response.json({error:'Alias limit reached'},{status:429});
     const random = Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
     const address = 'verify-'+random+'@interplanetaryfund.com';
     const row = await api.entities.VerificationMailbox.create({
       user_id:userId,platform,address,status:'pending_activation',created_at:new Date().toISOString()
     });
     return Response.json({ok:true,mailbox:{address:row.address,platform:row.platform,status:row.status}});
   }
   if (mode === 'open') {
     const mailId = String(body.mail_id || '').slice(0,128);
     if (!mailId) return Response.json({error:'Message required'},{status:400});
     const mail = await api.entities.VerificationMail.get(mailId).catch(()=>null);
     if (!mail || mail.user_id!==userId || Date.parse(mail.expires_at)<Date.now()) return Response.json({error:'Message unavailable or expired'},{status:404});
     const data = await openMail(mail);
     return Response.json({ok:true,mail:{id:mail.id,sender:mail.sender,subject:data.subject,text:data.text,expires_at:mail.expires_at}}, {headers:{'Cache-Control':'no-store'}});
   }
   if (mode==='list') {
     const [aliases,messages]=await Promise.all([
       api.entities.VerificationMailbox.filter({user_id:userId},'-created_date',100),
       api.entities.VerificationMail.filter({user_id:userId},'-created_date',100)
     ]);
     const live = messages.filter((m:any)=> Date.parse(m.expires_at)>Date.now());
     return Response.json({ok:true,mailboxes:aliases.map((m:any)=>({id:m.id,address:m.address,platform:m.platform,status:m.status})),
       messages:live.map((m:any)=>({id:m.id,sender:m.sender,received_at:m.received_at,expires_at:m.expires_at,alias_id:m.alias_id}))},
       {headers:{'Cache-Control':'no-store'}});
   }
   return Response.json({error:'Unsupported operation'},{status:400});
 } catch(e) {
   console.error('manageVerificationMailbox error:',e instanceof Error?e.name:'Error');
   return Response.json({error:'Verification inbox is unavailable'},{status:503});
 }
}
