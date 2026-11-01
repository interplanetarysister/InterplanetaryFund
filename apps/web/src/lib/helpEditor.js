import {HELP_CATEGORY_NAMES,helpSlug} from "./helpCenter.js";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DRAFT_FIELDS="id,author_id,article_id,category,question,description,answer,slug,keywords,stage,created_at,updated_at";
const PUBLIC_FIELDS="id,category,question,description,answer,slug,keywords,helpful_yes,helpful_no,created_at,updated_at";

async function adminUser(client){
 const {data,error}=await client.auth.getUser();
 const user=data?.user;
 if(error||!UUID.test(user?.id||"")||
    !["admin","super_admin"].includes(user?.app_metadata?.role))
   throw new Error("Administrator session could not be verified.");
 return user.id;
}
export function helpDraftPayload(input){
 if(!input||typeof input!=="object")throw new Error("Help article is required.");
 const question=String(input.question||"").trim();
 const slug=String(input.slug||"").trim();
 const category=String(input.category||"");
 const description=String(input.description||"").trim();
 const answer=String(input.answer||"");
 const keywords=Array.isArray(input.keywords)?
   [...new Set(input.keywords.map(v=>String(v).trim()).filter(Boolean))].slice(0,24):[];
 if(question.length<1||question.length>160||
    slug!==helpSlug(slug)||!slug||slug.length>100||
    !HELP_CATEGORY_NAMES.includes(category)||
    description.length>300||answer.length>20000||
    keywords.some(value=>value.length>80))
   throw new Error("A valid title, permanent URL, category and article fields are required.");
 return {question,slug,category,description,answer,keywords,stage:"draft"};
}
export async function loadHelpEditorRecords(client){
 await adminUser(client);
 const [drafts,published]=await Promise.all([
  client.from("ifund_help_drafts").select(DRAFT_FIELDS)
    .order("created_at",{ascending:false}).limit(200),
  client.from("ifund_help_articles").select(PUBLIC_FIELDS)
    .order("created_at",{ascending:false}).limit(200)
 ]);
 if(drafts.error||published.error||!Array.isArray(drafts.data)||
    !Array.isArray(published.data))
   throw new Error("We couldn't load Help Center records.");
 return {drafts:drafts.data,published:published.data};
}
export async function saveHelpDraft(client,input,{draftId=null,articleId=null}={}){
 const owner=await adminUser(client);
 const payload=helpDraftPayload(input);
 if(draftId && !UUID.test(draftId))throw new Error("Invalid draft.");
 if(articleId && !UUID.test(articleId))throw new Error("Invalid linked article.");
 let response;
 if(draftId){
  response=await client.from("ifund_help_drafts")
    .update(payload).eq("id",draftId).select(DRAFT_FIELDS).maybeSingle();
 }else{
  response=await client.from("ifund_help_drafts")
    .insert({...payload,author_id:owner,article_id:articleId})
    .select(DRAFT_FIELDS).maybeSingle();
 }
 if(response.error||!response.data?.id)
   throw new Error("Draft save was not confirmed. Nothing was published.");
 return response.data;
}
export async function publishHelpDraft(client,draftId){
 await adminUser(client);
 if(!UUID.test(draftId||""))throw new Error("Save a valid private draft before publishing.");
 const {data,error}=await client.rpc("ifund_publish_help_draft",{p_draft_id:draftId});
 if(error||!UUID.test(data||""))
   throw new Error("Publish was not confirmed. Check the published list before retrying.");
 const response=await client.from("ifund_help_articles")
   .select(PUBLIC_FIELDS).eq("id",data).maybeSingle();
 if(response.error||!response.data||response.data.id!==data||
    !response.data.answer?.trim())
   throw new Error("Published article could not be verified. Check the published list.");
 return response.data;
}
