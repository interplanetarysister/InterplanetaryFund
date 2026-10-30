import { db } from "./supabase";

const BLOG_ID = "6ac9c315a7434f25c88834b5";

export async function getReporterBlog() {
  if (!db) throw new Error("The publication service is not configured.");
  const { data, error } = await db.from("ifund_blogs")
    .select("id,title,description,type,status,cover_image_url,owner_auth_user_id")
    .eq("id", BLOG_ID).eq("status", "active").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listReporterStories() {
  if (!db) throw new Error("The publication service is not configured.");
  const { data, error } = await db.from("ifund_blog_entries")
    .select("id,type,title,summary,featured,published_at,created_at")
    .eq("blog_id", BLOG_ID).eq("status", "published")
    .order("published_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function getReporterStory(id) {
  if (!db) throw new Error("The publication service is not configured.");
  const { data, error } = await db.from("ifund_blog_entries")
    .select("id,type,title,summary,body,featured,published_at,created_at")
    .eq("id", String(id)).eq("blog_id", BLOG_ID).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReporterWorkspace(userId) {
  if (!db || !userId) return { blog: null, entries: [] };
  const { data: blog, error } = await db.from("ifund_blogs")
    .select("id,title,description,owner_auth_user_id,legacy_owner_user_id")
    .eq("id", BLOG_ID).eq("owner_auth_user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!blog) return { blog: null, entries: [] };
  const { data: entries, error: entriesError } = await db.from("ifund_blog_entries")
    .select("id,type,title,summary,body,status,featured,published_at,created_at,updated_at")
    .eq("blog_id", BLOG_ID).eq("owner_auth_user_id", userId)
    .order("updated_at", { ascending: false });
  if (entriesError) throw entriesError;
  return { blog, entries: entries || [] };
}

export async function saveReporterStory({ user, id, title, summary, body, status = "draft" }) {
  if (!db || !user?.id) throw new Error("Sign in to manage the Reporter.");
  const { data: blog, error: blogError } = await db.from("ifund_blogs")
    .select("id,owner_auth_user_id,legacy_owner_user_id")
    .eq("id", BLOG_ID).eq("owner_auth_user_id", user.id).maybeSingle();
  if (blogError) throw blogError;
  if (!blog) throw new Error("This account is not the verified Reporter owner.");
  const { data: previous, error: previousError } = id
    ? await db.from("ifund_blog_entries").select("id,published_at,created_at")
      .eq("id", id).eq("blog_id", BLOG_ID).eq("owner_auth_user_id", user.id).maybeSingle()
    : { data: null, error: null };
  if (previousError) throw previousError;
  const now = new Date().toISOString();
  const row = {
    id: id || crypto.randomUUID(),
    blog_id: BLOG_ID,
    owner_auth_user_id: user.id,
    legacy_owner_user_id: blog.legacy_owner_user_id,
    legacy_created_by_id: blog.legacy_owner_user_id,
    type: "article",
    title: title.trim(),
    summary: summary.trim(),
    body,
    status,
    featured: false,
    published_at: status === "published" ? (previous?.published_at || now) : null,
    created_at: previous?.created_at || now,
    updated_at: now,
  };
  const { data, error } = await db.from("ifund_blog_entries").upsert(row, { onConflict: "id" })
    .select("id,title,status,published_at,updated_at").single();
  if (error) throw error;
  return data;
}
