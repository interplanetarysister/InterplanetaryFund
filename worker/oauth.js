import { authenticatedUser, response } from './reads.js';

const PROVIDERS = Object.freeze({
  google: {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID', clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'], tokenAuth: 'body', pkce: true,
    subject: (data) => data.sub,
  },
  youtube: {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID', clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload'],
    tokenAuth: 'body', pkce: true,
    subject: (data) => data.items?.[0]?.id,
  },
  linkedin: {
    clientId: 'LINKEDIN_OAUTH_CLIENT_ID', clientSecret: 'LINKEDIN_OAUTH_CLIENT_SECRET',
    authorize: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    profile: 'https://api.linkedin.com/v2/userinfo',
    scopes: ['openid', 'profile', 'email', 'w_member_social'], tokenAuth: 'body', pkce: false,
    subject: (data) => data.sub,
  },
  x: {
    clientId: 'X_OAUTH_CLIENT_ID', clientSecret: 'X_OAUTH_CLIENT_SECRET',
    authorize: 'https://x.com/i/oauth2/authorize',
    token: 'https://api.x.com/2/oauth2/token',
    profile: 'https://api.x.com/2/users/me?user.fields=id,name,username',
    scopes: ['users.read', 'tweet.read', 'offline.access'], tokenAuth: 'basic', pkce: true,
    subject: (data) => data.data?.id,
  },
  tiktok: {
    clientId: 'TIKTOK_CLIENT_KEY', clientSecret: 'TIKTOK_CLIENT_SECRET',
    authorize: 'https://www.tiktok.com/v2/auth/authorize/',
    token: 'https://open.tiktokapis.com/v2/oauth/token/',
    profile: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
    scopes: ['user.info.basic', 'video.list', 'video.upload'], tokenAuth: 'tiktok',
    scopeDelimiter: ',', pkce: false,
    subject: (data) => data.data?.user?.open_id,
  },
  facebook_pages: {
    clientId: 'META_OAUTH_CLIENT_ID', clientSecret: 'META_OAUTH_CLIENT_SECRET',
    authorize: 'https://www.facebook.com/v26.0/dialog/oauth',
    token: 'https://graph.facebook.com/v26.0/oauth/access_token',
    tokenMethod: 'GET', tokenAuth: 'query', noGrantType: true,
    profile: 'https://graph.facebook.com/v26.0/me?fields=id,name,email',
    permissions: 'https://graph.facebook.com/v26.0/me/permissions',
    capability: 'https://graph.facebook.com/v26.0/me/accounts?fields=id,name,tasks&limit=100',
    requiredScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    scopeDelimiter: ',', pkce: false, allowMissingTokenType: true,
    subject: (data) => data.id,
    verifyCapability: (data) => Array.isArray(data.data) && data.data.some((page) =>
      !!page?.id && Array.isArray(page.tasks) &&
      page.tasks.some((task) => ['CREATE_CONTENT', 'MANAGE'].includes(task))),
  },
  instagram: {
    clientId: 'INSTAGRAM_OAUTH_CLIENT_ID', clientSecret: 'INSTAGRAM_OAUTH_CLIENT_SECRET',
    authorize: 'https://www.instagram.com/oauth/authorize',
    token: 'https://api.instagram.com/oauth/access_token',
    tokenAuth: 'body', tokenMethod: 'POST',
    profile: 'https://graph.instagram.com/me?fields=user_id,username',
    scopes: ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_comments', 'instagram_business_manage_messages', 'instagram_business_manage_insights'],
    scopeDelimiter: ',', pkce: false,
    subject: (data) => data.user_id || data.id,
  },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const JSON_TYPE = /^application\/json(?:\s*;|\s*$)/i;

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}
async function digest(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function constantTimeEqual(leftValue, rightValue) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(leftValue)),
    crypto.subtle.digest('SHA-256', encoder.encode(rightValue)),
  ]);
  const left = new Uint8Array(leftHash);
  const right = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
function randomSecret(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return base64url(bytes);
}
async function encryptionKey(env) {
  const raw = fromBase64(env.OAUTH_ENCRYPTION_KEY || '');
  if (raw.length !== 32) throw new Error('OAuth encryption is not configured.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptOAuthValue(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return { version: 1, iv: base64url(iv), ciphertext: base64url(new Uint8Array(ciphertext)) };
}
async function decryptOAuthValue(envelope, env) {
  if (!envelope || envelope.version !== 1 || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
    throw new Error('Invalid encrypted OAuth value.');
  }
  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.ciphertext));
  return JSON.parse(decoder.decode(plaintext));
}
function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}
function cookieHeader(provider, value, maxAge) {
  return `ifund_oauth_${provider}=${value}; Path=/api/oauth/${provider}/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function serviceHeaders(env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // New sb_secret_* keys are opaque API keys, not JWTs. Legacy service_role
  // keys are JWTs and must also be supplied as Authorization: Bearer.
  if (typeof key === 'string' && !key.startsWith('sb_secret_')) {
    headers.Authorization = 'Bearer ' + key;
  }
  return headers;
}
function serviceConfigured(env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return typeof key === 'string' && key.length > 20 &&
    typeof env.OAUTH_ENCRYPTION_KEY === 'string' && env.OAUTH_ENCRYPTION_KEY.length > 20;
}
function oauthRuntimeReady(env) {
  return env?.OAUTH_API_ENABLED === 'true' &&
    /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(env?.SUPABASE_URL || '') &&
    typeof env?.SUPABASE_PUBLISHABLE_KEY === 'string' &&
    env.SUPABASE_PUBLISHABLE_KEY.length > 0 &&
    typeof env?.OAUTH_FRONTEND_ORIGINS === 'string' && env.OAUTH_FRONTEND_ORIGINS.trim().length > 0 &&
    serviceConfigured(env);
}
function allowedFrontendOrigin(request, env) {
  const origin = request.headers.get('origin') || '';
  if (!origin || origin.length > 512) return '';
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) return '';
    const allowed = String(env.OAUTH_FRONTEND_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return allowed.includes(origin) ? origin : '';
  } catch {
    return '';
  }
}
function callbackUri(origin, provider) {
  return new URL('/oauth/callback/' + provider, origin).toString();
}
async function limitedRequestJson(request, maxBytes = 8192) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('OAuth callback body was too large.');
  }
  if (!request.body) throw new Error('OAuth callback body is empty.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error('OAuth callback body was too large.');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  const data = JSON.parse(decoder.decode(merged));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('OAuth callback body was invalid.');
  }
  return data;
}
function providerConfig(provider, env) {
  const config = PROVIDERS[provider];
  if (!config) return null;
  const approvalFlags = {
    youtube: 'YOUTUBE_OAUTH_ENABLED',
    linkedin: 'LINKEDIN_OIDC_ENABLED',
    x: 'X_OAUTH_USER_ENABLED',
    tiktok: 'TIKTOK_LOGIN_ENABLED',
    facebook_pages: 'META_PAGES_APPROVED',
    instagram: 'INSTAGRAM_BUSINESS_APPROVED',
  };
  const approvalFlag = approvalFlags[provider];
  if (approvalFlag && env[approvalFlag] !== 'true') return null;
  const clientId = env[config.clientId];
  const clientSecret = env[config.clientSecret];
  if (typeof clientId !== 'string' || !clientId.trim() || typeof clientSecret !== 'string' || !clientSecret.trim()) {
    return null;
  }
  const scopes = [...config.scopes];
  if (provider === 'linkedin' && env.LINKEDIN_POSTING_APPROVED !== 'true') {
    return { ...config, scopes: scopes.filter((scope) => scope !== 'w_member_social'), clientId, clientSecret };
  }
  if (provider === 'tiktok' && env.TIKTOK_VIDEO_UPLOAD_APPROVED !== 'true') {
    return { ...config, scopes: scopes.filter((scope) => scope !== 'video.upload'), clientId, clientSecret };
  }
  if (provider === 'youtube' && env.YOUTUBE_UPLOAD_APPROVED !== 'true') {
    return { ...config, scopes: scopes.filter((scope) => !scope.endsWith('/youtube.upload')), clientId, clientSecret };
  }
  return { ...config, scopes, clientId, clientSecret };
}
async function limitedJson(res) {
  if (!res.ok) throw new Error('OAuth provider request failed.');
  const type = res.headers.get('content-type') || '';
  if (!JSON_TYPE.test(type)) throw new Error('OAuth provider returned an invalid response.');
  const declaredLength = Number(res.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 32768) throw new Error('OAuth provider response was too large.');
  if (!res.body) throw new Error('OAuth provider returned an empty response.');
  const reader = res.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32768) {
      await reader.cancel();
      throw new Error('OAuth provider response was too large.');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  const body = decoder.decode(merged);
  const data = JSON.parse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('OAuth provider returned an invalid response.');
  return data;
}
async function supabaseRequest(env, path, options = {}, fetcher = fetch) {
  const res = await fetcher(env.SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    signal: options.signal || AbortSignal.timeout(10000),
    headers: { ...serviceHeaders(env), ...(options.headers || {}) },
    redirect: 'error',
  });
  if (!res.ok) throw new Error('OAuth credential storage failed.');
  return res;
}
async function exchangeCode(provider, config, code, verifier, redirectUri, fetcher) {
  const form = new URLSearchParams();
  if (!config.noGrantType) form.set('grant_type', 'authorization_code');
  form.set('code', code);
  form.set('redirect_uri', redirectUri);

  if (config.tokenAuth === 'tiktok') {
    form.set('client_key', config.clientId);
    form.set('client_secret', config.clientSecret);
  } else {
    form.set('client_id', config.clientId);
    if (config.tokenAuth === 'body' || config.tokenAuth === 'query') {
      form.set('client_secret', config.clientSecret);
    }
  }
  if (config.pkce) form.set('code_verifier', verifier);

  const headers = { accept: 'application/json' };
  let endpoint = config.token;
  let options;
  if (config.tokenMethod === 'GET') {
    const target = new URL(endpoint);
    for (const [key, value] of form) target.searchParams.set(key, value);
    endpoint = target.toString();
    options = { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(10000) };
  } else {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    if (config.tokenAuth === 'basic') {
      headers.authorization = 'Basic ' + btoa(config.clientId + ':' + config.clientSecret);
    }
    options = {
      method: 'POST', headers, body: form.toString(), redirect: 'error',
      signal: AbortSignal.timeout(10000),
    };
  }

  const res = await fetcher(endpoint, options);
  const token = await limitedJson(res);
  if (typeof token.access_token !== 'string' || !token.access_token ||
      (!config.allowMissingTokenType && token.token_type?.toLowerCase() !== 'bearer') ||
      (token.token_type && token.token_type.toLowerCase() !== 'bearer')) {
    throw new Error('OAuth provider did not issue a bearer token.');
  }

  // Instagram Login issues a short-lived token first. Exchange it server-side
  // for the long-lived token before persisting it.
  if (provider === 'instagram') {
    const longLived = new URL('https://graph.instagram.com/access_token');
    longLived.searchParams.set('grant_type', 'ig_exchange_token');
    longLived.searchParams.set('client_secret', config.clientSecret);
    longLived.searchParams.set('access_token', token.access_token);
    const longResponse = await fetcher(longLived.toString(), {
      method: 'GET', headers: { accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const longToken = await limitedJson(longResponse);
    if (typeof longToken.access_token !== 'string' || !longToken.access_token) {
      throw new Error('Instagram did not issue a long-lived token.');
    }
    return { ...token, ...longToken, permissions: token.permissions, scope: token.scope };
  }
  return token;
}
async function fetchIdentity(config, token, fetcher) {
  const res = await fetcher(config.profile, {
    headers: { authorization: 'Bearer ' + token.access_token, accept: 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const data = await limitedJson(res);
  const subject = config.subject(data);
  if (typeof subject !== 'string' && typeof subject !== 'number') {
    throw new Error('OAuth provider identity could not be verified.');
  }
  if (!String(subject) || String(subject).length > 255) {
    throw new Error('OAuth provider identity could not be verified.');
  }

  let grantedScopes = [];
  if (config.permissions) {
    const permissionResponse = await fetcher(config.permissions, {
      headers: { authorization: 'Bearer ' + token.access_token, accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const permissionData = await limitedJson(permissionResponse);
    grantedScopes = (Array.isArray(permissionData.data) ? permissionData.data : [])
      .filter((item) => item?.status === 'granted')
      .map((item) => String(item.permission || ''))
      .filter(Boolean);
    if (config.requiredScopes?.some((scope) => !grantedScopes.includes(scope))) {
      throw new Error('Required provider permissions were not granted.');
    }
  }

  if (config.capability) {
    const capabilityResponse = await fetcher(config.capability, {
      headers: { authorization: 'Bearer ' + token.access_token, accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const capabilityData = await limitedJson(capabilityResponse);
    if (typeof config.verifyCapability === 'function' && !config.verifyCapability(capabilityData)) {
      throw new Error('The required provider account capability could not be verified.');
    }
  }

  if (!grantedScopes.length) {
    const scopeValue = token.scope || token.scopes || token.permissions;
    if (Array.isArray(scopeValue)) grantedScopes = scopeValue.map(String);
    else if (typeof scopeValue === 'string') grantedScopes = scopeValue.split(/[ ,]+/).filter(Boolean);
  }
  return { subject: String(subject), profile: data, grantedScopes };
}

async function refreshProviderToken(provider, config, previous, fetcher) {
  if (provider === 'instagram') {
    const endpoint = new URL('https://graph.instagram.com/refresh_access_token');
    endpoint.searchParams.set('grant_type', 'ig_refresh_token');
    endpoint.searchParams.set('access_token', previous.access_token);
    const res = await fetcher(endpoint.toString(), {
      method: 'GET', headers: { accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const refreshed = await limitedJson(res);
    if (typeof refreshed.access_token !== 'string' || !refreshed.access_token) {
      throw new Error('Instagram token refresh failed.');
    }
    return {
      ...previous, ...refreshed, token_type: 'Bearer',
      refresh_token: previous.refresh_token || null,
      permissions: previous.permissions,
    };
  }

  const form = new URLSearchParams();
  if (provider === 'facebook_pages') {
    form.set('grant_type', 'fb_exchange_token');
    form.set('client_id', config.clientId);
    form.set('client_secret', config.clientSecret);
    form.set('fb_exchange_token', previous.access_token);
  } else {
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', previous.refresh_token);
    if (config.tokenAuth === 'tiktok') {
      form.set('client_key', config.clientId);
      form.set('client_secret', config.clientSecret);
    } else {
      form.set('client_id', config.clientId);
      if (config.tokenAuth === 'body' || config.tokenAuth === 'query') {
        form.set('client_secret', config.clientSecret);
      }
    }
  }

  const headers = { accept: 'application/json' };
  let endpoint = config.token;
  let options;
  if (provider === 'facebook_pages' || config.tokenMethod === 'GET') {
    const target = new URL(endpoint);
    for (const [key, value] of form) target.searchParams.set(key, value);
    endpoint = target.toString();
    options = {
      method: 'GET', headers, redirect: 'error',
      signal: AbortSignal.timeout(10000),
    };
  } else {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    if (config.tokenAuth === 'basic') {
      headers.authorization = 'Basic ' + btoa(config.clientId + ':' + config.clientSecret);
    }
    options = {
      method: 'POST', headers, body: form.toString(), redirect: 'error',
      signal: AbortSignal.timeout(10000),
    };
  }

  const res = await fetcher(endpoint, options);
  const refreshed = await limitedJson(res);
  if (typeof refreshed.access_token !== 'string' || !refreshed.access_token ||
      (!config.allowMissingTokenType && refreshed.token_type?.toLowerCase() !== 'bearer') ||
      (refreshed.token_type && refreshed.token_type.toLowerCase() !== 'bearer')) {
    throw new Error('OAuth provider token refresh failed.');
  }
  return {
    ...previous,
    ...refreshed,
    token_type: 'Bearer',
    refresh_token: typeof refreshed.refresh_token === 'string' && refreshed.refresh_token
      ? refreshed.refresh_token : previous.refresh_token || null,
    scope: typeof refreshed.scope === 'string' ? refreshed.scope : previous.scope,
  };
}

async function refreshConnection(provider, account, config, env, fetcher) {
  const query = new URLSearchParams({
    select: 'provider_subject,token_ciphertext,granted_scopes',
    owner_id: 'eq.' + account.uid,
    provider: 'eq.' + provider,
    limit: '1',
  });
  const storedResponse = await supabaseRequest(env, 'ifund_provider_tokens?' + query.toString(), {}, fetcher);
  const rows = await storedResponse.json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    return response(404, { error: 'No saved provider connection was found.' });
  }

  const previous = await decryptOAuthValue(rows[0].token_ciphertext, env);
  if (!previous || typeof previous.access_token !== 'string') {
    return response(409, { error: 'The provider connection needs to be reconnected.' });
  }
  if (provider !== 'facebook_pages' && provider !== 'instagram' &&
      typeof previous.refresh_token !== 'string') {
    return response(409, { error: 'The provider connection needs to be reconnected.' });
  }

  const refreshed = await refreshProviderToken(provider, config, previous, fetcher);
  const identity = await fetchIdentity(config, refreshed, fetcher);
  if (identity.subject !== rows[0].provider_subject) {
    throw new Error('The refreshed provider identity did not match the saved account.');
  }

  const scopes = identity.grantedScopes.length
    ? identity.grantedScopes
    : Array.isArray(rows[0].granted_scopes) ? rows[0].granted_scopes : [];
  const expiresIn = Number(refreshed.expires_in);
  const refreshExpiresIn = Number(refreshed.refresh_token_expires_in || refreshed.refresh_expires_in);
  const tokenPayload = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || null,
    token_type: 'Bearer',
    scope: typeof refreshed.scope === 'string' ? refreshed.scope : scopes.join(' '),
    expires_at: Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    refresh_expires_at: Number.isFinite(refreshExpiresIn)
      ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
      : previous.refresh_expires_at || null,
  };
  const encryptedTokens = await encryptOAuthValue(tokenPayload, env);
  await supabaseRequest(env, 'rpc/ifund_store_provider_connection', {
    method: 'POST',
    body: JSON.stringify({
      p_owner_id: account.uid, p_provider: provider,
      p_provider_subject: identity.subject, p_token_ciphertext: encryptedTokens,
      p_granted_scopes: scopes,
    }),
  }, fetcher);
  return response(200, {
    provider, status: 'connected', refreshed: true,
    expires_at: tokenPayload.expires_at,
  });
}

export async function routeOAuthRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/api/oauth/status') {
    if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
    if (!oauthRuntimeReady(env)) return response(503, { error: 'Provider connections are not configured.' });
    const origin = allowedFrontendOrigin(request, env);
    if (!origin) return response(403, { error: 'Origin not allowed.' });
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to view provider availability.' });
    const providers = Object.fromEntries(Object.keys(PROVIDERS).map((name) => [name, !!providerConfig(name, env)]));
    return response(200, { enabled: true, providers });
  }
  const match = /^\/api\/oauth\/([a-z_]+)\/(start|callback|refresh)$/.exec(url.pathname);
  if (!match) return response(404, { error: 'Not found.' });
  const [, provider, action] = match;
  if (!PROVIDERS[provider]) return response(404, { error: 'Provider not supported.' });
  if (!oauthRuntimeReady(env)) return response(503, { error: 'Provider connections are not configured.' });

  const origin = allowedFrontendOrigin(request, env);
  if (!origin) return response(403, { error: 'Origin not allowed.' });
  const redirectUri = callbackUri(origin, provider);
  const config = providerConfig(provider, env);
  if (!config) return response(503, { error: 'This provider is not configured yet.' });

  if (action === 'refresh') {
    if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in before refreshing a provider connection.' });
    try {
      return await refreshConnection(provider, account, config, env, fetcher);
    } catch {
      return response(503, { error: 'Provider token refresh could not be completed.' });
    }
  }

  if (action === 'start') {
    if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in before connecting a provider.' });
    const state = randomSecret(32);
    const verifier = randomSecret(48);
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
    try {
      const expiryQuery = new URLSearchParams({ expires_at: 'lt.' + new Date().toISOString() });
      await supabaseRequest(env, 'ifund_oauth_transactions?' + expiryQuery.toString(), {
        method: 'DELETE', headers: { Prefer: 'return=minimal' },
      }, fetcher);
      const encryptedVerifier = await encryptOAuthValue({ verifier }, env);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const row = {
        state_hash: await digest(state), owner_id: account.uid, provider,
        verifier_ciphertext: encryptedVerifier, redirect_uri: redirectUri, expires_at: expiresAt,
      };
      await supabaseRequest(env, 'ifund_oauth_transactions', {
        method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row),
      }, fetcher);
      const authorize = new URL(config.authorize);
      authorize.search = new URLSearchParams({
        response_type: 'code', client_id: config.clientId, redirect_uri: redirectUri,
        scope: config.scopes.join(config.scopeDelimiter || ' '), state,
      }).toString();
      if (config.pkce) {
        authorize.searchParams.set('code_challenge', challenge);
        authorize.searchParams.set('code_challenge_method', 'S256');
      }
      if (provider === 'google' || provider === 'youtube') {
        authorize.searchParams.set('access_type', 'offline');
        authorize.searchParams.set('prompt', 'consent');
      }
      if (provider === 'tiktok') {
        authorize.searchParams.delete('client_id');
        authorize.searchParams.set('client_key', config.clientId);
      }
      return response(200, { authorization_url: authorize.toString() });
    } catch {
      return response(503, { error: 'Could not start provider authorization.' });
    }
  }

  if (action !== 'callback' || request.method !== 'POST') {
    return response(405, { error: 'Method not allowed.' });
  }
  const account = await authenticatedUser(request, env, fetcher);
  if (!account) return response(401, { error: 'Sign in to finish provider authorization.' });

  try {
    const body = await limitedRequestJson(request);
    const code = typeof body.code === 'string' ? body.code : '';
    const state = typeof body.state === 'string' ? body.state : '';
    const callbackScopes = typeof body.scopes === 'string' ? body.scopes : '';
    if (!code || code.length > 4096 || !state || state.length > 256 ||
        body.redirect_uri !== redirectUri) {
      return response(400, { error: 'Provider authorization could not be verified.' });
    }

    const hash = await digest(state);
    const params = new URLSearchParams({
      select: 'state_hash,owner_id,provider,verifier_ciphertext,redirect_uri,expires_at',
      state_hash: 'eq.' + hash, provider: 'eq.' + provider,
      owner_id: 'eq.' + account.uid,
      expires_at: 'gt.' + new Date().toISOString(),
    });
    const txResponse = await supabaseRequest(env, 'ifund_oauth_transactions?' + params.toString(), {
      method: 'DELETE', headers: { Prefer: 'return=representation' },
    }, fetcher);
    const rows = await txResponse.json();
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].provider !== provider ||
        rows[0].owner_id !== account.uid || rows[0].redirect_uri !== redirectUri ||
        !(await constantTimeEqual(rows[0].state_hash, hash))) {
      return response(400, { error: 'Provider authorization could not be verified.' });
    }

    const verifierRecord = await decryptOAuthValue(rows[0].verifier_ciphertext, env);
    if (typeof verifierRecord.verifier !== 'string') throw new Error('Invalid PKCE verifier.');
    const token = await exchangeCode(provider, config, code, verifierRecord.verifier, redirectUri, fetcher);
    const identity = await fetchIdentity(config, token, fetcher);
    const existingQuery = new URLSearchParams({
      select: 'token_ciphertext', owner_id: 'eq.' + rows[0].owner_id,
      provider: 'eq.' + provider, limit: '1',
    });
    const existingResponse = await supabaseRequest(env, 'ifund_provider_tokens?' + existingQuery.toString(), {}, fetcher);
    const existingRows = await existingResponse.json();
    let previousTokens = null;
    if (Array.isArray(existingRows) && existingRows.length === 1) {
      previousTokens = await decryptOAuthValue(existingRows[0].token_ciphertext, env);
    }
    const refreshToken = typeof token.refresh_token === 'string' && token.refresh_token
      ? token.refresh_token : previousTokens?.refresh_token || null;
    const tokenPayload = {
      access_token: token.access_token,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      scope: typeof token.scope === 'string' ? token.scope : identity.grantedScopes.join(' '),
      expires_at: Number.isFinite(Number(token.expires_in)) ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      refresh_expires_at: Number.isFinite(Number(token.refresh_token_expires_in || token.refresh_expires_in))
        ? new Date(Date.now() + Number(token.refresh_token_expires_in || token.refresh_expires_in) * 1000).toISOString()
        : previousTokens?.refresh_expires_at || null,
    };
    const encryptedTokens = await encryptOAuthValue(tokenPayload, env);
    const scopes = identity.grantedScopes.length
      ? identity.grantedScopes
      : callbackScopes.split(/[ ,]+/).filter(Boolean);
    await supabaseRequest(env, 'rpc/ifund_store_provider_connection', {
      method: 'POST', body: JSON.stringify({
        p_owner_id: rows[0].owner_id, p_provider: provider,
        p_provider_subject: identity.subject, p_token_ciphertext: encryptedTokens,
        p_granted_scopes: scopes,
      }),
    }, fetcher);
    return response(200, { provider, status: 'connected', verified: true });
  } catch {
    return response(400, { error: 'Provider authorization could not be verified.' });
  }
}

export const oauthProviders = Object.freeze(Object.keys(PROVIDERS));
