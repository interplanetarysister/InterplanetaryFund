// Read-only editorial queries for the canonical Supabase project.
// Historical drafts, subscriber-only editing and official publishing remain
// protected until original identities and entitlement audits are complete.
import { authClient } from "@/api/auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY="id,blog_id,owner_id,type,title,summary,body,status,featured,published_at,created_at,blog:ifund_user_blogs!inner(id,owner_id,type,title,description,cover_image_url,author_display_name,status)";
const PUBLICATION="id,kind,title,summary,body,pdf_url,file_label,status,final_approved,published_at";

export async function listPublishedStories({author="",limit=100}={}){
  if(author && !UUID.test(author))throw new Error("Invalid story author reference.");
  let query=authClient().from("ifund_blog_entries")
    .select(ENTRY).eq("status","published").eq("blog.status","active")
    .order("published_at",{ascending:false}).limit(Math.min(100,Math.max(1,limit)));
  if(author)query=query.eq("owner_id",author);
  const {data,error}=await query;
  if(error||!Array.isArray(data))throw new Error("IFund stories could not be loaded.");
  return data.filter(x=>x.status==="published" && x.blog?.status==="active");
}

export async function getPublishedStory(id){
  if(!UUID.test(id||""))return null;
  const {data,error}=await authClient().from("ifund_blog_entries")
    .select(ENTRY).eq("id",id).eq("status","published")
    .eq("blog.status","active").maybeSingle();
  if(error)throw new Error("The story is unavailable.");
  return data?.status==="published"&&data?.blog?.status==="active"?data:null;
}

export async function getFinalPublication(id){
  if(!UUID.test(id||""))return null;
  const {data,error}=await authClient().from("ifund_official_publications")
    .select(PUBLICATION).eq("id",id)
    .eq("status","published").eq("final_approved",true).maybeSingle();
  if(error)throw new Error("This publication is unavailable.");
  return data?.status==="published"&&data?.final_approved===true?data:null;
}

export async function listFinalPublications(limit=100){
  const {data,error}=await authClient().from("ifund_official_publications")
    .select(PUBLICATION).eq("status","published")
    .eq("final_approved",true)
    .order("published_at",{ascending:false}).limit(Math.min(100,Math.max(1,limit)));
  if(error||!Array.isArray(data))throw new Error("IFund publications could not be loaded.");
  return data.filter(item=>item.status==="published"&&item.final_approved===true);
}
