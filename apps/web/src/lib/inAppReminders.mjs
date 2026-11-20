// In-app only. The server owns all recipient, timing, quota and dispatch decisions.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS="id,owner_id,title,body,due_at,status,attempts,notification_id,created_at";
async function owner(client){
  const {data,error}=await client.auth.getUser();
  const user=data?.user;
  if(error||!UUID.test(user?.id||"")||!user?.email_confirmed_at||user.is_anonymous===true)
    throw new Error("Sign in with a verified account to manage reminders.");
  return user.id;
}
export async function loadInAppReminders(client){
  const id=await owner(client);
  const {data,error}=await client.from("ifund_inapp_reminder_queue").select(FIELDS)
    .eq("owner_id",id).order("created_at",{ascending:false}).limit(20);
  if(error||!Array.isArray(data)||data.some(r=>r.owner_id!==id))
    throw new Error("Your private reminder queue could not be verified.");
  return data;
}
export async function scheduleInAppReminder(client,{title,body,dueAt,requestId}){
  const id=await owner(client);
  const normalizedTitle=title?.trim(),normalizedBody=body?.trim();
  const instant=new Date(dueAt);
  if(!UUID.test(requestId||"")||typeof normalizedTitle!=="string"||normalizedTitle.length<4||normalizedTitle.length>100||
     typeof normalizedBody!=="string"||normalizedBody.length<8||normalizedBody.length>1000||
     !Number.isFinite(instant.getTime())||instant.getTime()<Date.now()+60_000||
     instant.getTime()>Date.now()+30*86400_000)
    throw new Error("Enter a title, message, and time between 1 minute and 30 days ahead.");
  const due=instant.toISOString();
  const {data,error}=await client.rpc("ifund_schedule_inapp_reminder",{
    p_request_id:requestId,p_title:normalizedTitle,p_body:normalizedBody,p_due_at:due,
  });
  if(error||!Array.isArray(data)||data.length!==1||data[0]?.reminder_id!==requestId||
      !["queued","delivered"].includes(data[0]?.reminder_status))
    throw new Error(error?.message||"The reminder was not scheduled.");
  const {data:record,error:readError}=await client.from("ifund_inapp_reminder_queue")
    .select(FIELDS).eq("owner_id",id).eq("id",requestId).maybeSingle();
  if(readError||!record||record.id!==requestId||record.owner_id!==id||
     record.title!==normalizedTitle||record.body!==normalizedBody||
     Math.abs(Date.parse(record.due_at)-instant.getTime())>1000)
    throw new Error("The reminder could not be confirmed in your account. Check the queue before retrying.");
  return record;
}
export async function cancelInAppReminder(client,id){
  if(!UUID.test(id||""))throw new Error("Invalid reminder.");
  const ownerId=await owner(client);
  const {data,error}=await client.rpc("ifund_cancel_inapp_reminder",{p_reminder_id:id});
  if(error||!Array.isArray(data)||data.length!==1||data[0]?.reminder_id!==id||
     !["cancelled","delivered","failed"].includes(data[0]?.reminder_status))
    throw new Error(error?.message||"The cancellation could not be confirmed.");
  const {data:record,error:readError}=await client.from("ifund_inapp_reminder_queue")
    .select(FIELDS).eq("owner_id",ownerId).eq("id",id).maybeSingle();
  if(readError||!record||record.id!==id||record.owner_id!==ownerId||
     record.status!==data[0].reminder_status)
    throw new Error("The latest reminder status could not be verified.");
  return record;
}
