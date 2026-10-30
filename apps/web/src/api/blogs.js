import { authClient } from "@/api/auth";

const BLOG_ID = "6ac9c315a7434f25c88834b5";

export async function getReporterBlog() {
  const { data, error } = await authClient().from("ifund_blogs")
    .select("id,title,description,type,status,cover_image_url,owner_auth_user_id")
    .eq("id", BLOG_ID).eq("status", "active").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublishedBlogEntries({ limit = 100 } = {}) {
  const { data, error } = await authClient().from("ifund_blog_entries")
    .select("id,blog_id,type,title,summary,body,featured,published_at,created_at")
    .eq("blog_id", BLOG_ID).eq("status", "published")
    .order("published_at", { ascending: false }).limit(Math.min(200, Math.max(1, limit)));
  if (error) throw error;
  return data || [];
}

export async function getPublishedBlogEntry(id) {
  const { data, error } = await authClient().from("ifund_blog_entries")
    .select("id,blog_id,type,title,summary,body,featured,published_at,created_at")
    .eq("id", String(id)).eq("blog_id", BLOG_ID).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOwnerBlogWorkspace() {
  const auth = authClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError) throw authError;
  if (!user) return { user: null, blog: null, entries: [] };
  const { data: blog, error } = await auth.from("ifund_blogs")
    .select("id,title,description,owner_auth_user_id,legacy_owner_user_id")
    .eq("id", BLOG_ID).eq("owner_auth_user_id", user.id).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!blog) return { user, blog: null, entries: [] };
  const { data: entries, error: entriesError } = await auth.from("ifund_blog_entries")
    .select("id,type,title,summary,body,status,featured,published_at,created_at,updated_at")
    .eq("blog_id", BLOG_ID).eq("owner_auth_user_id", user.id)
    .order("updated_at", { ascending: false });
  if (entriesError) throw entriesError;
  return { user, blog, entries: entries || [] };
}

export async function saveOwnerBlogEntry({ id, title, summary, body, status = "draft" }) {
  const auth = authClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to manage the Reporter.");
  const { data: blog, error: blogError } = await auth.from("ifund_blogs")
    .select("id,owner_auth_user_id,legacy_owner_user_id")
    .eq("id", BLOG_ID).eq("owner_auth_user_id", user.id).maybeSingle();
  if (blogError) throw blogError;
  if (!blog) throw new Error("This account is not the verified Reporter owner.");
  const existing = id ? (await auth.from("ifund_blog_entries")
    .select("id,published_at,created_at").eq("id", id).eq("blog_id", BLOG_ID)
    .eq("owner_auth_user_id", user.id).maybeSingle()) : { data: null, error: null };
  if (existing.error) throw existing.error;
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
    published_at: status === "published" ? (existing.data?.published_at || now) : null,
    created_at: existing.data?.created_at || now,
    updated_at: now,
  };
  const { data, error } = await auth.from("ifund_blog_entries").upsert(row, { onConflict: "id" })
    .select("id,title,status,published_at,updated_at").single();
  if (error) throw error;
  return data;
}
