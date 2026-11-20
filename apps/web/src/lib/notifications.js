// Owner-only in-app notifications. No browser notification creation,
// no financial notice mirroring and no unverified Android push registration.
// A future trusted producer can insert source_event_id-deduplicated notices.
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS="id,owner_id,title,body,type,link,read,created_at";

async function ownerId(client){
  const {data,error}=await client.auth.getUser();
  if(error || !isVerifiedEmailUser(data?.user) || !UUID.test(data?.user?.id||""))
    throw new Error("Sign in to view your notifications.");
  return data.user.id;
}

export function safeNoticeDestination(path){
  if(typeof path!=="string" || path.length>512 ||
     !path.startsWith("/") || path.startsWith("//") ||
     /[\\\u0000-\u001f\u007f]/.test(path) ||
     /%(?:2f|5c|00|0a|0d)/i.test(path))return null;
  try {
    const decoded=decodeURIComponent(path);
    if(decoded.startsWith("//") || decoded.includes("\\"))return null;
    const url=new URL(path,"https://ifund.invalid");
    if(url.origin!=="https://ifund.invalid")return null;
    // Strict internal destination allowlist; unknown source links remain text.
    if(!/^\/(?:campaign\/[a-f0-9-]{36}|community(?:\/[a-f0-9-]{36})?|blogs(?:\/[a-f0-9-]{36})?|following|notifications|dashboard|inbox|mine)(?:[?#].*)?$/i.test(path))
      return null;
    return path;
  } catch {return null;}
}

export async function loadNotifications(client){
  const owner=await ownerId(client);
  const {data,error}=await client.from("ifund_notifications")
    .select(COLUMNS).eq("owner_id",owner)
    .order("created_at",{ascending:false}).limit(50);
  if(error || !Array.isArray(data))
    throw new Error("Notifications could not be loaded.");
  if(data.some(item=>item.owner_id!==owner))
    throw new Error("Notification ownership verification failed.");
  return data;
}

export async function acknowledgeNotification(client,notificationId){
  if(!UUID.test(notificationId||""))throw new Error("Invalid notification.");
  const owner=await ownerId(client);
  const {data,error}=await client.from("ifund_notifications")
    .update({read:true}).eq("owner_id",owner).eq("id",notificationId)
    .select("id,owner_id,read").maybeSingle();
  if(error || !data || data.id!==notificationId || data.owner_id!==owner ||
     data.read!==true)throw new Error("Notification acknowledgement not confirmed.");
  return data.id;
}

export async function acknowledgeAllNotifications(client){
  const owner=await ownerId(client);
  const {data,error}=await client.from("ifund_notifications")
    .update({read:true}).eq("owner_id",owner).eq("read",false)
    .select("id,owner_id,read");
  if(error || !Array.isArray(data) ||
     data.some(item=>item.owner_id!==owner || item.read!==true))
    throw new Error("Notification acknowledgements not confirmed.");
  return data.length;
}


/**
 * Verify the complete free in-app delivery path as the signed-in owner.
 * The database RPC is idempotent for the owner and UTC date. It produces no
 * external message and grants no capability to contact another account.
 */
export async function verifyInAppNotificationDelivery(client){
  const owner=await ownerId(client);
  const {data,error}=await client.rpc("ifund_notification_delivery_selfcheck");
  if(error || !Array.isArray(data) || data.length!==1 ||
    !UUID.test(data[0]?.notification_id||""))
    throw new Error("An in-app delivery receipt was not created. No external message was sent.");
  const receipt=data[0];
  const {data:record,error:readError}=await client.from("ifund_notifications")
    .select(COLUMNS).eq("owner_id",owner)
    .eq("id",receipt.notification_id).maybeSingle();
  if(readError || !record || record.id!==receipt.notification_id ||
    record.owner_id!==owner)
    throw new Error("The private inbox could not confirm the delivered notice.");
  if(record.title!=="Your iFund inbox is connected" || record.type!=="system")
    throw new Error("The inbox returned an unexpected delivery receipt.");
  return {id:record.id,deliveredAt:receipt.delivered_at,
    alreadyExists:receipt.already_exists===true};
}
