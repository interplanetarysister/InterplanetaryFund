import {routeMemberMedia} from "../../../../../../worker/media/memberMedia.js";

// Explicit same-origin Pages Function; never proxy private R2 bytes to Base44.
export function onRequest({request,env}){
 return routeMemberMedia(request,env);
}
