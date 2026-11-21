// Same-origin Pages alias for the isolated sandbox checkout handler.
// This path is used by the regular campaign dialog on Pages PREVIEW only.
// Never forwards any sandbox payment to the production donation ledger.
import {onRequest as sandboxCheckout} from "../../paypal/sandbox/[[path]].js";

export async function onRequest(context){
  const requestUrl=new URL(context.request.url);
  if(!/^(?:[a-z0-9-]+\.)?interplanetaryfund-migration\.pages\.dev$/.test(requestUrl.hostname)||
      requestUrl.protocol!=="https:")
    return Response.json({ok:false,error:"sandbox_preview_only"},{status:403});
  const result=await sandboxCheckout(context);
  const cookie=result.headers.get("set-cookie");
  if(!cookie||context.request.method!=="POST")return result;
  const response=new Response(result.body,result);
  response.headers.set("set-cookie",cookie.replace(/Path=\/api\/paypal\/sandbox(?=;|$)/i,
    "Path=/api/payments/sandbox"));
  return response;
}
