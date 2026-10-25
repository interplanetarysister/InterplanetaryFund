import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { staticRecipe, orderedTransports, requiresRouteRediscovery } from '../../shared/platformConnectionRecipes.ts';

const seedFor=(platform:string,operation:string)=>staticRecipe(platform,operation);
const order=(r:any)=>orderedTransports(r);
const clean=(v:unknown,max=300)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);

export default async function handler(req: Request) {
  const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
  try {
    const user=await base44.auth.me();
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const platform=clean(body.platform,80).toLowerCase();
    const operation=clean(body.operation||'connect',80).toLowerCase();
    const result=clean(body.result,30).toLowerCase();
    const transport=clean(body.transport,50).toLowerCase();
    const detail=clean(body.detail,500);
    if(!platform||!operation) return Response.json({error:'platform and operation are required'},{status:400});

    const rows=await base44.asServiceRole.entities.PlatformConnectionRecipe.filter({platform,operation});
    const recipe=rows?.[0]||null;
    const seed=seedFor(platform,operation);

    if(!result){
      const effective=recipe&&recipe.status!=='disabled'?recipe:seed?{platform,operation,status:'probation',discovery_state:'probation',rediscovery_on_failure:true,...seed}:{platform,operation,status:'probation',discovery_state:'unknown',rediscovery_on_failure:true,preferred_transport:'manual'};
      const transportOrder=order(effective);
      const nextCandidate=transportOrder.find((candidate)=>candidate!=='manual')||null;
      const rediscoveryRequired=requiresRouteRediscovery(effective,transportOrder);
      return Response.json({platform,operation,recipe:effective,transport_order:transportOrder,next_candidate:nextCandidate,rediscovery_required:rediscoveryRequired});
    }

    // Recipe reads are available to authenticated users, but caller-supplied
    // success/failure assertions are not provider evidence. Keep recipe learning
    // server-owned until a verified transport can write evidence internally.
    if (result) {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin required to update shared connection recipes' }, { status: 403 });
      }
      return Response.json({
        error: 'Connection recipe evidence must come from a verified server-side check.',
        code: 'provider_evidence_required',
      }, { status: 409 });
    }
  } catch(error) {
    console.error('resolvePlatformConnectionRecipe error:', error?.name || 'UnknownError');
    return Response.json({error:'Could not resolve platform connection recipe.'},{status:500});
  }
}
