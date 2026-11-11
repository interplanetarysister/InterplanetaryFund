import { authClient } from "@/api/auth";

export const MEMBER_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const avatarUrl = (id, key) => `/api/profile/avatar?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`;

export async function loadMyProfile() {
  const client = authClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in to view your profile.");
  const { data, error } = await client.rpc("ifund_my_profile_settings");
  if (error || data?.id !== user.id) throw new Error("Your profile could not be loaded.");
  return { ...data, email: user.email };
}

export async function saveMyProfile(profile) {
  const { data, error } = await authClient().rpc("ifund_save_my_profile", {
    p_display_name: profile.display_name.trim(),
    p_handle: profile.handle.trim(),
    p_bio: profile.bio.trim(),
    p_public: profile.public_profile_enabled,
    p_show_posts: profile.show_posts,
    p_featured_campaign_ids: profile.featured_campaign_ids,
  });
  if (error?.code === "23505") throw new Error("That handle is already in use.");
  if (error?.code === "22023") throw new Error("Check your profile fields and refresh the campaign list if it changed.");
  if (error || data?.id !== profile.id) throw new Error("Your profile could not be saved.");
  return { ...data, email: profile.email };
}

export async function getPublicProfile(id) {
  if (!MEMBER_ID.test(id || "")) return null;
  const { data, error } = await authClient().rpc("ifund_public_member_profile", { p_id: id });
  if (error) throw new Error("The profile could not be loaded.");
  return data;
}

export async function profilePhotoRequest(url, options = {}) {
  const { data } = await authClient().auth.getSession();
  if (!data?.session?.access_token) throw new Error("Sign in to manage your photo.");
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.error || "Your profile photo could not be loaded.");
  }
  return response;
}
