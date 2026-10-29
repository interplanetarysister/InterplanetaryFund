// Independent content-only campaign publication.
// No donation, payment, grant, external platform sync or agent work is triggered.
export const CATEGORIES = Object.freeze([
  "medical", "emergency", "education", "community", "animals", "business",
  "memorial", "disaster_relief", "creative", "environment", "other",
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GOAL=/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/;

export function validateCampaignContent(form, { publish = false } = {}) {
  const title=String(form?.title||"").trim();
  const summary=String(form?.summary||"").trim();
  const story=String(form?.story||"").trim();
  const category=String(form?.category||"");
  const cover_image_url=String(form?.cover_image_url||"").trim();
  const text=String(form?.goal_amount??"").trim();
  if(title.length>120 || summary.length>600 || story.length>15000 ||
    cover_image_url.length>2048) throw new Error("Campaign text exceeds the permitted size.");
  if(!CATEGORIES.includes(category)) throw new Error("Choose a valid campaign category.");
  if(text && !GOAL.test(text)) throw new Error("Enter a nonnegative USD goal with at most two decimals.");
  const goal_amount=text?Number(text):0;
  if(cover_image_url){
    let url;
    try { url=new URL(cover_image_url); } catch { throw new Error("Enter a valid image URL."); }
    if(!["https:","http:"].includes(url.protocol)||url.username||url.password)
      throw new Error("Cover images must use a public web URL.");
  }
  if(publish && (!title || !summary || !story || goal_amount<=0))
    throw new Error("Publication requires a title, summary, story and positive fundraising goal.");
  return {title,summary,story,category,goal_amount,cover_image_url,status:publish?"active":"draft"};
}

export async function persistCampaignContent(client, form, { id = null, publish = false } = {}) {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid campaign reference.");
  const payload=validateCampaignContent(form,{publish});
  const {data:account,error:authError}=await client.auth.getUser();
  if(authError||!account?.user?.id) throw new Error("Please sign in to save this campaign.");
  const owner_id=account.user.id;
  const write=id
    ? client.from("ifund_campaigns").update(payload).eq("id",id).eq("owner_id",owner_id).eq("status","draft")
    : client.from("ifund_campaigns").insert({...payload,owner_id});
  const {data,error}=await write.select("id,status").single();
  if(error) throw new Error("The campaign could not be saved. Please retry.");
  if(!UUID.test(data?.id||"") || data.status!==payload.status)
    throw new Error("The campaign server did not confirm the requested state.");
  return {id:data.id,status:data.status};
}
