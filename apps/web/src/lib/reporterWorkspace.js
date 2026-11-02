// Owner-side reporter publishing, ported from the root app's src/lib/blogs.js.
//
// This is the one user-facing capability the root app had and apps/web did not:
// creating, saving and publishing member stories under a blog the user owns.
// Porting it is what makes apps/web a true superset before it becomes canonical.
//
// Two things are deliberate here:
//
// 1. The blog owner is checked in the client *and* in RLS. The client check is
//    defence in depth and gives a clear message; the boundary is the
//    ifund_blog_entries policy fixed in
//    20261102_ifund_blog_entry_ownership_fix.sql (blocker B20). Before that fix
//    the policy was self-referential and any authenticated account could file a
//    published entry under someone else's blog.
// 2. The account lifecycle gate is applied, matching socialPosts.js, so a
//    suspended or unconfirmed account cannot publish.
//
// The blog id is the legacy Base44 identifier, which is text, not a UUID. That
// is why entry ids are generated here and validated as opaque refs rather than
// as UUIDs.

import { verifyAccountLifecycle } from "./accountLifecycle.js";
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";
import { validEditorialRef } from "./editorialContracts.js";

export const REPORTER_BLOG_ID = "6ac9c315a7434f25c88834b5";
export const MAX_TITLE_LENGTH = 160;
export const MAX_SUMMARY_LENGTH = 400;
export const MAX_BODY_LENGTH = 40000;

const ENTRY_COLUMNS =
  "id,blog_id,type,title,summary,body,status,featured,published_at,created_at,updated_at";

/**
 * Normalize a draft for saving. Returns a structured error rather than throwing
 * so the form can render one message path.
 */
export function validateStory({ title, summary, body, status = "draft" }) {
  if (status !== "draft" && status !== "published")
    return { ok: false, message: "A story is either a draft or published." };
  const t = typeof title === "string" ? title.trim() : "";
  const s = typeof summary === "string" ? summary.trim() : "";
  const b = typeof body === "string" ? body : "";
  if (t.length < 1 || t.length > MAX_TITLE_LENGTH)
    return {
      ok: false,
      message: `A title is required, up to ${MAX_TITLE_LENGTH} characters.`,
    };
  if (s.length > MAX_SUMMARY_LENGTH)
    return {
      ok: false,
      message: `The summary can be up to ${MAX_SUMMARY_LENGTH} characters.`,
    };
  if (b.trim().length < 1 || b.length > MAX_BODY_LENGTH)
    return {
      ok: false,
      message: `A story body is required, up to ${MAX_BODY_LENGTH} characters.`,
    };
  if (status === "published" && s.length < 1)
    return { ok: false, message: "Add a summary before publishing." };
  return { ok: true, value: { title: t, summary: s, body: b, status } };
}

/** Only a provider-confirmed email on an active account may publish. */
export async function canManagePublication(client, user) {
  if (!isVerifiedEmailUser(user)) {
    return {
      ok: false,
      message: "Confirm your email address before publishing.",
    };
  }
  const lifecycle = await verifyAccountLifecycle(client, user);
  return lifecycle.ok
    ? { ok: true }
    : { ok: false, message: lifecycle.message };
}

/**
 * The workspace: the blog this user owns, plus their entries. Returns empty when
 * the user owns no blog, which is the normal case for most members — the blog
 * list is read-only for them.
 */
export async function loadReporterWorkspace(client, user) {
  if (!user?.id) return { blog: null, entries: [] };
  const { data: blog, error } = await client
    .from("ifund_blogs")
    .select("id,title,description,owner_auth_user_id,status")
    .eq("id", REPORTER_BLOG_ID)
    .eq("owner_auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Your publication could not be loaded.");
  if (!blog || blog.owner_auth_user_id !== user.id)
    return { blog: null, entries: [] };

  const { data: entries, error: entriesError } = await client
    .from("ifund_blog_entries")
    .select(ENTRY_COLUMNS)
    .eq("blog_id", REPORTER_BLOG_ID)
    .eq("owner_auth_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (entriesError) throw new Error("Your stories could not be loaded.");
  return { blog, entries: Array.isArray(entries) ? entries : [] };
}

/**
 * Create or update a story. The caller must own the blog; that is re-verified
 * here rather than trusted from the page, and RLS enforces it again.
 */
export async function saveReporterStory(client, user, input) {
  const gate = await canManagePublication(client, user);
  if (!gate.ok) throw new Error(gate.message);

  const checked = validateStory(input);
  if (!checked.ok) throw new Error(checked.message);
  const { title, summary, body, status } = checked.value;

  // Re-check ownership immediately before writing, so a page that cached a
  // workspace cannot be used to write after ownership changed.
  const { data: blog, error: blogError } = await client
    .from("ifund_blogs")
    .select("id,owner_auth_user_id,legacy_owner_user_id")
    .eq("id", REPORTER_BLOG_ID)
    .eq("owner_auth_user_id", user.id)
    .maybeSingle();
  if (blogError) throw new Error("Your publication could not be verified.");
  if (!blog || blog.owner_auth_user_id !== user.id)
    throw new Error("This account does not own the publication.");

  const id = input.id;
  if (id !== undefined && id !== null && id !== "" && !validEditorialRef(id))
    throw new Error("That story reference is not valid.");

  const now = new Date().toISOString();
  let previous = null;
  if (id) {
    const { data, error } = await client
      .from("ifund_blog_entries")
      .select("id,published_at,created_at")
      .eq("id", id)
      .eq("blog_id", REPORTER_BLOG_ID)
      .eq("owner_auth_user_id", user.id)
      .maybeSingle();
    if (error) throw new Error("That story could not be loaded.");
    if (!data) throw new Error("That story is not yours to edit.");
    previous = data;
  }

  const row = {
    id: id || crypto.randomUUID(),
    blog_id: REPORTER_BLOG_ID,
    owner_auth_user_id: user.id,
    legacy_owner_user_id: blog.legacy_owner_user_id,
    type: "article",
    title,
    summary,
    body,
    status,
    featured: false,
    published_at: status === "published" ? previous?.published_at || now : null,
    created_at: previous?.created_at || now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("ifund_blog_entries")
    .upsert(row, { onConflict: "id" })
    .select("id,owner_auth_user_id,title,status,published_at,updated_at")
    .single();
  if (error) throw new Error("Your story was not saved. Please try again.");
  if (data?.owner_auth_user_id !== user.id || data?.id !== row.id)
    throw new Error("Your story was not saved as expected.");
  return data;
}
