import { helpArticles,helpArticleBySlug } from "./helpArticles.js";
import {helpSlug} from "./helpCenter.js";

const FIELDS="id,slug,category,question,description,answer,keywords,created_at,updated_at";
export async function listPublicHelpArticles(client){
 const response=await client.from("ifund_help_articles")
   .select(FIELDS).order("created_at",{ascending:false}).limit(200);
 if(response.error || !Array.isArray(response.data))
   // Bundled independent migration guidance remains available even before
   // admin editor and historical records are authorized for production.
   return {articles:[...helpArticles],live:false};
 const bySlug=new Map(helpArticles.map(a=>[a.slug,a]));
 for(const article of response.data){
   if(article?.slug && helpSlug(article.slug)===article.slug &&
      typeof article.answer==="string" && article.answer.trim())
     bySlug.set(article.slug,article);
 }
 return {articles:[...bySlug.values()],live:true};
}
export async function getPublicHelpArticle(client,slug){
 if(typeof slug!=="string"||slug!==helpSlug(slug)||!slug)
   return {article:null,live:false};
 const response=await client.from("ifund_help_articles")
  .select(FIELDS).eq("slug",slug).maybeSingle();
 if(!response.error && response.data){
   return {article:response.data,live:true};
 }
 return {article:helpArticleBySlug(slug),live:false};
}
