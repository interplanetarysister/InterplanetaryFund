import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { assertActiveAccount } from "../../shared/accountGuard.ts";
import { logAudit } from "../../shared/auditLog.ts";
import { round2 } from "../../shared/fees.js";

const ALLOWED_SOURCES = new Set(["GoFundMe","Kickstarter","Indiegogo","Facebook","GiveSendGo","CashApp","PayPal","Other"]);

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok) return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user;
    if(user.role!=="admin") return Response.json({error:"Forbidden"},{status:403});

    const body=await req.json().catch(()=>({}));
    const campaignId=String(body.campaign_id||"");
    const sourcePlatform=String(body.source_platform||"");
    const requestId=String(body.request_id||"");
    const gross=round2(Number(body.gross_amount));
    if(!campaignId||!requestId||requestId.length>160) return Response.json({error:"Campaign and request id are required."},{status:400});
    if(!Number.isFinite(gross)||gross<=0||gross>10000000) return Response.json({error:"Migration amount is invalid."},{status:400});
    if(!ALLOWED_SOURCES.has(sourcePlatform)) return Response.json({error:"Migration source is invalid."},{status:400});

    const sr=base44.asServiceRole;
    const campaign=await sr.entities.Campaign.get(campaignId).catch(()=>null);
    if(!campaign?.id||!campaign?.created_by_id) return Response.json({error:"Campaign was not found or has no owner."},{status:404});

    const existing=await sr.entities.ExternalFundMigrationRecord.filter({request_id:requestId}).catch(()=>[]);
    if(existing?.length){
      const row=existing[0];
      return Response.json({
        ok:true,
        duplicate:true,
        migration_id:row.id,
        state:row.state,
        reported_amount:Number(row.reported_amount||0),
        prospective_platform_fee:Number(row.prospective_platform_fee||0),
        prospective_net:Number(row.prospective_net||0),
      });
    }

    const fee=round2(gross*0.03);
    const net=round2(gross-fee);
    const record=await sr.entities.ExternalFundMigrationRecord.create({
      request_id:requestId,
      campaign_id:campaign.id,
      beneficiary_user_id:campaign.created_by_id,
      campaign_title:campaign.title||"",
      source_platform:sourcePlatform,
      reported_amount:gross,
      currency:"USD",
      prospective_platform_fee:fee,
      prospective_net:net,
      state:"recorded",
      note:"Admin-entered reconciliation record only. This does not represent provider verification, IFund custody, withdrawal eligibility, or a payout. Match it to independent provider/custody evidence before any financial state changes.",
    });

    await logAudit(base44,{
      action:"external_fund_migration_recorded",
      actor_user_id:user.id,
      target_type:"ExternalFundMigrationRecord",
      target_id:record.id,
      detail:`campaign=${campaign.id} source=${sourcePlatform} reported=${gross} state=recorded`,
      status:"success",
      metadata:{request_id:requestId},
    });

    return Response.json({
      ok:true,
      duplicate:false,
      migration_id:record.id,
      state:"recorded",
      reported_amount:gross,
      prospective_platform_fee:fee,
      prospective_net:net,
    });
  }catch(error){
    console.error("recordExternalFundMigration failed",error?.name||"UnknownError");
    return Response.json({error:"Unable to record this migration safely."},{status:500});
  }
}
