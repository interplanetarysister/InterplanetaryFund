import { routePrivateDocuments } from "../../../../../../worker/media/privateDocuments.js";

// An explicit Pages Function route takes priority over the generic /api/* proxy.
export function onRequest({request,env}){
 return routePrivateDocuments(request,env);
}
