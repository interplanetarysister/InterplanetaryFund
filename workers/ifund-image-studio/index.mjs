// Isolated free-quota Cloudflare Workers AI service for campaign art.
// Mirrors canonical worker/imageStudio.js and imageImprove.js handlers.
// All requests require the verified member and Supabase atomic quota.
import { routeImageStudio } from "../../worker/imageStudio.js";
import { routeImageImprove } from "../../worker/imageImprove.js";
export default {fetch(request,env){const path=new URL(request.url).pathname;
 if(path==="/api/ai/images/generate")return routeImageStudio(request,env);
 if(path==="/api/ai/images/improve")return routeImageImprove(request,env);
 return Response.json({error:"Not found."},{status:404});}};
