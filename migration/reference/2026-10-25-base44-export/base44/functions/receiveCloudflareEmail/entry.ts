import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sealMail } from '../../shared/verificationEmailCrypto.ts';

// Cloudflare Email Worker -> IFund private admin inbox. Public key is not secret;
// Cloudflare stores the signing private key securely as a Worker secret.
const publicKeySpkiBase64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEULHIdTiu+6Z0jkuABd0Gj483NXCk5EfjdPk9vBKgCmyGzCTpipzOOfqPvCwh4dOYqa/tm+lipTjopYKBZyQEWg==';
const ownerId = '6a67a778342a8fe05ee79cbb';
const ownerEmail = 'cuddlemeplatonically@gmail.com';
const encoder = new TextEncoder();
const priorities = new Set(['contact','support','admin','ifund','campaigns','help','developer','partner','crowdfund'].map(name => name + '@interplanetaryfund.com'));
const clean = (value, max) => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202e]/g, '').slice(0,max);
const validRecipient = (address) => /^[^\s@<>\u0000-\u001f]{1,64}@interplanetaryfund\.com$/.test(address);
const fromB64 = value => Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
const fromHex = value => Uint8Array.from(value.match(/.{2}/g) || [], pair => parseInt(pair,16));

async function authenticated(req, body) {
  const stamp = req.headers.get('x-ifund-email-timestamp') || '';
  const sig = req.headers.get('x-ifund-email-signature') || '';
  if (!/^\d{10}$/.test(stamp) || !/^[a-f0-9]{128}$/i.test(sig)) return false;
  if (Math.abs(Date.now() - Number(stamp)*1000) > 300_000) return false;
  const key = await crypto.subtle.importKey('spki', fromB64(publicKeySpkiBase64),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,fromHex(sig),encoder.encode(stamp+'.'+body));
}

export default async function(req) {
  if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
  try {
    const raw = await req.text();
    if (raw.length > 65536) return Response.json({error:'Payload too large'},{status:413});
    if (!(await authenticated(req,raw))) return Response.json({error:'Unauthorized'},{status:401});
    const payload = JSON.parse(raw);
    const to = clean(payload?.to,256).toLowerCase();
    if(!validRecipient(to)) return Response.json({error:'Unknown recipient domain'},{status:400});
    const from = clean(payload?.from,254), subject=clean(payload?.subject,240), text=clean(payload?.text,12000);
    const messageId=clean(payload?.message_id,254).replace(/[<>]/g,'');
    if (!from || !messageId) return Response.json({error:'Missing message metadata'},{status:400});
    const base44=createClientFromRequest(req), sr=base44.asServiceRole;
    if (to.startsWith('verify-')) {
      if (!/^verify-[a-f0-9]{32}@interplanetaryfund\.com$/.test(to))
        return Response.json({error:'Unknown verification alias'},{status:404});
      const matches=await sr.entities.VerificationMailbox.filter({address:to});
      const alias=(matches||[]).find(m=>m.status==='active');
      if(!alias) return Response.json({error:'Mailbox inactive'},{status:404});
      const recipient=await sr.entities.User.get(alias.user_id).catch(()=>null);
      if(!recipient || recipient.account_deletion_pending || (recipient.account_status && recipient.account_status!=='active'))
        return Response.json({error:'Mailbox unavailable'},{status:404});
      const msgKey=(to+':'+messageId).slice(0,254);
      const prior=await sr.entities.VerificationMail.filter({alias_id:alias.id,message_key:msgKey});
      if(prior?.length) return Response.json({ok:true,duplicate:true});
      let sealed;
      try {sealed=await sealMail({subject,text});}
      catch{return Response.json({error:'Mail encryption not configured'},{status:503});}
      const now=Date.now();
      await sr.entities.VerificationMail.create({user_id:alias.user_id,alias_id:alias.id,
        message_key:msgKey,sender:from,...sealed,received_at:new Date(now).toISOString(),
        expires_at:new Date(now+86400000).toISOString()});
      return Response.json({ok:true,verification_mail:true});
    }
    const owner=await sr.entities.User.get(ownerId).catch(()=>null);
    if (!owner || owner.role !== 'admin' || String(owner.email||'').toLowerCase() !== ownerEmail) return Response.json({error:'Mailbox owner unavailable'},{status:503});
    const key=(to+':'+messageId).slice(0,254);
    const prior=await sr.entities.InboxItem.filter({user_id:ownerId,platform:'email',external_message_id:key});
    if(prior?.length) return Response.json({ok:true,duplicate:true});
    const row=await sr.entities.InboxItem.create({
      user_id:ownerId,platform:'email',type:'message',author:from,
      external_message_id:key,recipient_address:to,
      mailbox_priority:priorities.has(to)?'priority':'normal',
      content:'Subject: '+(subject||'(no subject)')+'\n\n'+(text||'(No plain-text body)'),
      status:'open',reply_support:'unsupported'
    });
    return Response.json({ok:true,id:row.id});
  } catch(err) {
    console.error('receiveCloudflareEmail:', err?.name||'UnknownError');
    return Response.json({error:'Email intake failed safely'},{status:500});
  }
}
