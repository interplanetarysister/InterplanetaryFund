// Super-admin-only free-quota AI page layout drafts. No automatic publishing.
import {routeStudioGenerateRequest,routeStudioStatusRequest} from "../../worker/studioRoutes.js";
export default {fetch(request,env){const path=new URL(request.url).pathname;
 if(path==="/api/studio/generate")return routeStudioGenerateRequest(request,env);
 if(path==="/api/studio/status")return routeStudioStatusRequest(request,env);
 return Response.json({error:"Not found."},{status:404});}};
