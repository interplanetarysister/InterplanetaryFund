import { verifyAccountLifecycle } from "./accountLifecycle.js";
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";
import { validEditorialRef } from "./editorialContracts.js";

export const REPORTER_BLOG_ID = "6ac9c315a7434f25c88834b5";
export const MAX_TITLE_LENGTH = 160;
export const MAX_SUMMARY_LENGTH = 400;
export const MAX_BODY_LENGTH = 40000;

export function validateStory({ title, summary, body, status = "draft" }) {
  if (status !== "draft" && status !== "published")
    return { ok: false, message: "A story is either a draft or published." };
  const t = typeof title === "string" ? title.trim() : "";
  const s = typeof summary === "string" ? summary.trim() : "";
  const b = typeof body === "string" ? body : "";
  if (t.length < 1 || t.length > MAX_TITLE_LENGTH)
    return { ok: false, message: `A title is required, up to ${MAX_TITLE_LENGTH} characters.` };
  if (s.length > MAX_SUMMARY_LENGTH)
    return { ok: false, message: `The summary can be up to ${MAX_SUMMARY_LENGTH} characters.` };
  if (b.trim().length < 1 || b.length > MAX_BODY_LENGTH)
    return { ok: false, message: `A story body is required, up to ${MAX_BODY_LENGTH} characters.` };
  if (status === "published" && s.length < 1)
    return { ok: false, message: "Add a summary before publishing." };
  return { ok: true, value: { title: t, summary: s, body: b, status } };
}

export async function canManagePublication(client, user) {
  if (!isVerifiedEmailUser(user)) return { ok: false, message: "Confirm your email address before publishing." };
  const lifecycle = await verifyAccountLifecycle(client, user);
  return lifecycle.ok ? { ok: true } : { ok: false, message: lifecycle.message };
}

export async function loadReporterWorkspace(client, user) {
  if (!isVerifiedEmailUser(user)) return { blogs: [], can_create: false };
  const { data, error } = await client.rpc("ifund_my_blog_workspace");
  if (error || !Array.isArray(data?.blogs)) throw new Error("Your publication could not be loaded.");
  return data;
}

export async function createMemberBlog(client, { title, description }) {
  const { data, error } = await client.rpc("ifund_create_member_blog", {
    p_title: title.trim(), p_description: description.trim(),
  });
  if (error || !validEditorialRef(data)) throw new Error("Your blog could not be created. Check your subscription and try again.");
  return data;
}

export async function saveReporterStory(client, user, input) {
  const gate = await canManagePublication(client, user);
  if (!gate.ok) throw new Error(gate.message);
  const checked = validateStory(input);
  if (!checked.ok) throw new Error(checked.message);
  const { id, blogId = REPORTER_BLOG_ID } = input;
  if (!validEditorialRef(blogId) || (id && !validEditorialRef(id)))
    throw new Error("That story reference is not valid.");
  const { title, summary, body, status } = checked.value;
  const { data, error } = await client.rpc("ifund_save_blog_story", {
    p_blog_id: blogId, p_entry_id: id || null, p_title: title, p_summary: summary,
    p_body: body, p_status: status,
  });
  if (error?.code === "42501") throw new Error("You do not have publishing access to this blog or story.");
  if (error) throw new Error("Your story was not saved. Please try again.");
  if (data?.blog_id !== blogId || !validEditorialRef(data.id) || (id && data.id !== id)
    || (status === "published" && data.status !== "published"))
    throw new Error("Your story was not saved as expected.");
  return data;
}
