// Source-aligned public editorial content, using the *verified live* Supabase
// schema. The old draft branch referenced a nonexistent relation and UUID entry IDs;
// neither matches production. Keep all unpublished author data private.
import { authClient } from "@/api/auth";
import {
  validEditorialRef, limitEditorialResults, verifiedPublishedEntries, verifiedPublications,
} from "./editorialContracts.js";

const PUBLICATIONS = "id,kind,title,summary,body,pdf_url,file_label,status,final_approved,published_at";

export async function listPublishedStories({ author = "", limit = 100 } = {}) {
  if (author && !validEditorialRef(author)) throw new Error("Invalid story author reference.");
  const { data, error } = await authClient().rpc("ifund_public_blog_entries_read", {
    p_author_ref: author || null,
    p_blog_id: null,
    p_entry_id: null,
    p_limit: limitEditorialResults(limit),
  });
  if (error) throw new Error("IFund stories could not be loaded.");
  return verifiedPublishedEntries(data);
}

export async function getPublishedStory(id) {
  if (!validEditorialRef(id)) return null;
  const { data, error } = await authClient().rpc("ifund_public_blog_entries_read", {
    p_author_ref: null,
    p_blog_id: null,
    p_entry_id: id,
    p_limit: 1,
  });
  if (error) throw new Error("This story is unavailable.");
  return verifiedPublishedEntries(data).find(row => row.id === id) || null;
}

export async function getFinalPublication(id) {
  if (!validEditorialRef(id)) return null;
  const { data, error } = await authClient().from("ifund_official_publications")
    .select(PUBLICATIONS).eq("id", id).eq("status", "published")
    .eq("final_approved", true).maybeSingle();
  if (error) throw new Error("This publication is unavailable.");
  return verifiedPublications(data ? [data] : []).find(row => row.id === id) || null;
}

export async function listFinalPublications(limit = 100) {
  const { data, error } = await authClient().from("ifund_official_publications")
    .select(PUBLICATIONS).eq("status", "published").eq("final_approved", true)
    .order("published_at", { ascending: false }).limit(limitEditorialResults(limit));
  if (error) throw new Error("IFund publications could not be loaded.");
  return verifiedPublications(data);
}
