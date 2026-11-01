import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import {
  DEVICE_SCOPES, DEVICE_CODE_LIFETIME_MS, DEVICE_GRANT_LIFETIME_MS,
  DEVICE_POLL_INTERVAL_SECONDS, secretDeviceCode, visibleUserCode,
  canonicalUserCode, validUserCode, deviceHash, userCodeHash,
  accessTokenFor, accessTokenHash, approvedScopes, ownerSafeGrant,
  requireStrictDeviceLimit,
} from '../../shared/deviceAuthorization.ts';

const APP_ORIGIN = 'https://interplanetaryfund.com';
const CLIENT_TYPES = new Set(['ifund-device-v1','ifund-cli-v1','ifund-agent-v1']);
const fail = (error: string,status=400) => Response.json({error},{status});
const epoch = (stamp: string) => Number.isFinite(Date.parse(stamp)) ? Date.parse(stamp) : 0;
const past = (row: any,field='expires_at') => epoch(row?.[field]) <= Date.now();

async function exactRow(sr: any,field: string,value: string) {
  const result = await sr.entities.DeviceAuthorization.filter({[field]:value},'-created_date',3);
  return result.length === 1 ? result[0] : null;
}

export default async function(req: Request) {
  try {
    if (req.method && req.method !== 'POST') return fail('POST required.',405);
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(()=>({}));
    const mode = String(body.mode || '');

    if (mode === 'start') {
      const clientId = String(body.client_id || '');
      const label = String(body.device_label || '').trim();
      const scopes = approvedScopes(body.scopes);
      if (!CLIENT_TYPES.has(clientId) || !label || label.length > 80 || !scopes.length) {
        return fail('Choose a supported device type, name, and read-only permissions.');
      }
      const ip = String(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') ||
        req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0,80);
      const limited = await requireStrictDeviceLimit(sr,'ifund:device-start:' + await deviceHash(ip),8,600);
      if (!limited) return fail('Too many device requests. Try again later.',429);

      const deviceCode = secretDeviceCode();
      const bearer = await accessTokenFor(deviceCode);
      let userCode = '';
      let codeHash = '';
      for (let i=0;i<5;i++) {
        userCode=visibleUserCode();
        codeHash=await userCodeHash(userCode);
        const collisions=await sr.entities.DeviceAuthorization.filter({user_code_hash:codeHash},'-created_date',1);
        if (collisions.length === 0) break;
        userCode='';
      }
      if (!userCode) return fail('Could not reserve a unique approval code.',503);
      await sr.entities.DeviceAuthorization.create({
        device_code_hash:await deviceHash(deviceCode),
        user_code_hash:codeHash,
        access_token_hash:await accessTokenHash(bearer),
        client_id:clientId,device_label:label,scopes,state:'pending',
        owner_user_id:'',
        created_at:new Date().toISOString(),
        expires_at:new Date(Date.now()+DEVICE_CODE_LIFETIME_MS).toISOString(),
        approved_at:'',grant_expires_at:'',last_polled_at:'',
      });
      return Response.json({
        device_code:deviceCode,user_code:userCode,
        verification_uri:APP_ORIGIN+'/activate',
        verification_uri_complete:APP_ORIGIN+'/activate?code='+encodeURIComponent(userCode),
        expires_in:600,interval:DEVICE_POLL_INTERVAL_SECONDS,
      },{headers:{'Cache-Control':'no-store'}});
    }

    if (mode === 'poll') {
      if (body.grant_type !== 'urn:ietf:params:oauth:grant-type:device_code' ||
          typeof body.device_code !== 'string' || !/^[a-f0-9]{64}$/.test(body.device_code)) {
        return fail('invalid_request');
      }
      const hash=await deviceHash(body.device_code);
      if (!(await requireStrictDeviceLimit(sr,'ifund:device-poll:'+hash,35,300))) return fail('slow_down',429);
      const row=await exactRow(sr,'device_code_hash',hash);
      if (!row || past(row)) return fail('expired_token');
      if (row.state === 'denied' || row.state === 'revoked') return fail('access_denied');
      if (row.state !== 'approved') {
        if (epoch(row.last_polled_at) && Date.now()-epoch(row.last_polled_at) < DEVICE_POLL_INTERVAL_SECONDS*1000) {
          return fail('slow_down',429);
        }
        await sr.entities.DeviceAuthorization.update(row.id,{last_polled_at:new Date().toISOString()});
        return fail('authorization_pending');
      }
      if (past(row,'grant_expires_at')) return fail('expired_token');
      return Response.json({
        access_token:await accessTokenFor(body.device_code),
        token_type:'Bearer',
        expires_in:Math.max(0,Math.floor((epoch(row.grant_expires_at)-Date.now())/1000)),
        scope:row.scopes.join(' '),
      },{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
    }

    if (mode === 'resource') {
      // Device credentials never become a platform user session or a consent
      // to publish, withdraw money, connect providers, or act as an admin.
      const bearer=String(req.headers.get('x-ifund-device-token') || '');
      if (!/^ifd_at_[a-f0-9]{64}$/.test(bearer)) return fail('Device token required.',401);
      const row=await exactRow(sr,'access_token_hash',await accessTokenHash(bearer));
      if (!row || row.state !== 'approved' || past(row,'grant_expires_at')) return fail('Device access expired or revoked.',401);
      const owner=await sr.entities.User.get(row.owner_user_id).catch(()=>null);
      if (!owner || owner.account_deletion_pending ||
          (owner.account_status && owner.account_status !== 'active')) return fail('Account not active.',403);
      if (body.action === 'identity' && row.scopes.includes('identity:read')) {
        return Response.json({ok:true,identity:{
          id:owner.id,username:owner.username||'',display_name:owner.full_name||owner.username||'',
        }},{headers:{'Cache-Control':'no-store'}});
      }
      if (body.action === 'campaigns' && row.scopes.includes('campaigns:read')) {
        const campaigns=await sr.entities.Campaign.filter({created_by_id:owner.id},'-created_date',100);
        return Response.json({ok:true,campaigns:(campaigns||[]).map((c:any)=>({
          id:c.id,title:c.title||'',summary:c.summary||'',status:c.status||'',
          goal_amount:c.goal_amount||0,raised_amount:c.raised_amount||0,
        }))},{headers:{'Cache-Control':'no-store'}});
      }
      return fail('This device is not approved for that action.',403);
    }

    if (!['inspect','decide','list','revoke'].includes(mode)) return fail('Unsupported device request.');
    const active=await assertActiveAccount(base44);
    if (!active.ok) return fail(active.error||'Sign in to continue.',active.status);
    const owner=active.user;

    if (mode === 'inspect' || mode === 'decide') {
      const code=canonicalUserCode(body.user_code);
      if (!validUserCode(code)) return fail('Enter the 10-character approval code.');
      if (!(await requireStrictDeviceLimit(sr,'ifund:device-enter:'+owner.id,12,600))) {
        return fail('Too many code attempts. Please wait.',429);
      }
      const row=await exactRow(sr,'user_code_hash',await userCodeHash(code));
      if (!row || past(row)) return fail('Code is invalid or expired.',404);
      if (row.state !== 'pending') return fail('Code has already been used.',409);
      if (mode === 'inspect') return Response.json({
        ok:true,client_id:row.client_id,device_label:row.device_label,
        scopes:row.scopes.filter((s:string)=>DEVICE_SCOPES.includes(s)),expires_at:row.expires_at,
      });
      if (!['approve','deny'].includes(body.decision)) return fail('Choose Approve or Deny.');
      const patch = body.decision === 'approve' ? {
        state:'approved',owner_user_id:owner.id,approved_at:new Date().toISOString(),
        grant_expires_at:new Date(Date.now()+DEVICE_GRANT_LIFETIME_MS).toISOString(),
      } : {state:'denied',owner_user_id:owner.id};
      // Compare-and-set the PENDING state so two simultaneous human decisions
      // cannot silently transfer a grant between accounts.
      await sr.entities.DeviceAuthorization.updateMany(
        {id:row.id,state:'pending'},{$set:patch},
      );
      const persisted=await sr.entities.DeviceAuthorization.get(row.id);
      if (!persisted || persisted.owner_user_id !== owner.id ||
          persisted.state !== patch.state ||
          (patch.state === 'approved' && persisted.approved_at !== patch.approved_at)) {
        return fail('This authorization was already decided. Start a new request.',409);
      }
      return Response.json({ok:true,decision:body.decision});
    }

    if (mode === 'list') {
      const rows=await sr.entities.DeviceAuthorization.filter({owner_user_id:owner.id},'-created_date',100);
      return Response.json({ok:true,devices:(rows||[]).map(ownerSafeGrant)});
    }
    const row=await sr.entities.DeviceAuthorization.get(String(body.authorization_id||'')).catch(()=>null);
    if (!row || row.owner_user_id !== owner.id) return fail('Device not found.',404);
    if (row.state !== 'revoked') await sr.entities.DeviceAuthorization.update(row.id,{state:'revoked'});
    return Response.json({ok:true,revoked:true});
  } catch (error) {
    console.error('deviceAuthorization unavailable:',error instanceof Error ? error.name : 'UnknownError');
    return fail('Device authorization is unavailable. Try again later.',503);
  }
}
