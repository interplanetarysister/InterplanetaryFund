const FILE_LIMIT = 2 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

async function supabase(env, path, token, body) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return fetch(new URL(path, env.SUPABASE_URL || env.VITE_SUPABASE_URL), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      apikey: key,
      ...(token && { authorization: token }),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function imageType(bytes) {
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (bytes.slice(0, 3).join(",") === "255,216,255") return "image/jpeg";
  if (bytes.slice(0, 4).join(",") === "82,73,70,70" &&
      bytes.slice(8, 12).join(",") === "87,69,66,80") return "image/webp";
  return null;
}

async function boundedImage(request) {
  if (!request.body || Number(request.headers.get("content-length")) > FILE_LIMIT) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(FILE_LIMIT);
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return bytes.subarray(0, size);
    if (size + value.length > FILE_LIMIT) {
      await reader.cancel();
      return null;
    }
    bytes.set(value, size);
    size += value.length;
  }
}

export async function onRequestPut({ request, env }) {
  const token = request.headers.get("authorization");
  if (!/^Bearer [\w.-]+$/i.test(token || "")) return jsonError("Sign in to upload a profile photo.", 401);
  try {
    const result = await supabase(env, "/rest/v1/rpc/ifund_my_profile_settings", token, {});
    const profile = result.ok ? await result.json() : null;
    if (!UUID.test(profile?.id || "")) return jsonError("Verify your account to upload a profile photo.", 403);

    const bytes = await boundedImage(request);
    if (!bytes) return jsonError("Choose an image under 2 MB.", 413);
    const contentType = imageType(bytes);
    if (!contentType) return jsonError("Choose a JPEG, PNG, or WebP image.", 415);

    const key = crypto.randomUUID();
    const path = `profile-avatar/${profile.id}/${key}`;
    await env.IFUND_CAMPAIGN_MEDIA.put(path, bytes, { httpMetadata: { contentType } });
    try {
      const saved = await supabase(env, "/rest/v1/rpc/ifund_set_my_avatar", token, { p_key: key, p_previous_key: profile.avatar_key });
      if (!saved.ok || await saved.json() !== true) throw new Error("Avatar was not saved");
    } catch (error) {
      await env.IFUND_CAMPAIGN_MEDIA.delete(path);
      throw error;
    }
    if (UUID.test(profile.avatar_key || "")) {
      await env.IFUND_CAMPAIGN_MEDIA.delete(`profile-avatar/${profile.id}/${profile.avatar_key}`).catch(() => {});
    }
    return Response.json({ key });
  } catch {
    return jsonError("Your profile photo could not be uploaded.", 503);
  }
}

export async function onRequestGet({ request, env }) {
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  const key = query.get("key");
  if (!UUID.test(id || "") || !UUID.test(key || "")) return new Response(null, { status: 404 });
  try {
    const token = request.headers.get("authorization");
    const result = token
      ? await supabase(env, "/rest/v1/rpc/ifund_my_profile_settings", token, {})
      : await supabase(env, "/rest/v1/rpc/ifund_public_member_profile", null, { p_id: id });
    const profile = result.ok ? await result.json() : null;
    if (profile?.id !== id || profile.avatar_key !== key) return new Response(null, { status: 404 });
    const image = await env.IFUND_CAMPAIGN_MEDIA.get(`profile-avatar/${id}/${key}`);
    if (!image) return new Response(null, { status: 404 });
    return new Response(image.body, { headers: {
      "content-type": image.httpMetadata.contentType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    } });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function onRequestDelete({ request, env }) {
  const token = request.headers.get("authorization");
  if (!/^Bearer [\w.-]+$/i.test(token || "")) return jsonError("Sign in to remove your profile photo.", 401);
  try {
    const result = await supabase(env, "/rest/v1/rpc/ifund_my_profile_settings", token, {});
    const profile = result.ok ? await result.json() : null;
    if (!UUID.test(profile?.id || "")) return jsonError("Verify your account first.", 403);
    const key = profile.avatar_key;
    if (UUID.test(key || "")) {
      const saved = await supabase(env, "/rest/v1/rpc/ifund_set_my_avatar", token, {
        p_key: null, p_previous_key: key,
      });
      if (!saved.ok || await saved.json() !== true) return jsonError("Your photo changed. Reload and try again.", 409);
      await env.IFUND_CAMPAIGN_MEDIA.delete(`profile-avatar/${profile.id}/${key}`).catch(() => {});
    }
    return new Response(null, { status: 204 });
  } catch {
    return jsonError("Your profile photo could not be removed.", 503);
  }
}
