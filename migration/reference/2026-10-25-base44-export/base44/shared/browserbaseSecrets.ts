import { CipherSuite, Aes256Gcm, HkdfSha256 } from 'npm:@hpke/core@1.9.0';
import { DhkemX25519HkdfSha256 } from 'npm:@hpke/dhkem-x25519@1.8.0';

const API = 'https://api.browserbase.com';

function apiKey() {
  return Deno.env.get('Browserbase_api_token') || Deno.env.get('BROWSERBASE_API_KEY') || '';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(String(value || ''));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function request(path: string, init: RequestInit = {}) {
  const key = apiKey();
  if (!key) throw new Error('Browser credential service is not configured.');
  const headers = new Headers(init.headers || {});
  headers.set('X-BB-API-Key', key);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API}${path}`, { ...init, headers, signal: controller.signal });
    if (!response.ok) throw new Error(`Browser credential service request failed (${response.status}).`);
    if (response.status === 204) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function sealBrowserbaseSecret(value: string) {
  const keypair = await request('/v1/secrets/keypair');
  const publicKeyBytes = base64ToBytes(keypair?.publicKey || '');
  if (!keypair?.id || publicKeyBytes.byteLength !== 32) {
    throw new Error('Browser credential service returned an invalid encryption key.');
  }

  const suite = new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes256Gcm(),
  });
  const recipientPublicKey = await suite.kem.deserializePublicKey(publicKeyBytes.buffer);
  const plaintext = new TextEncoder().encode(value);
  const { enc, ct } = await suite.seal({ recipientPublicKey }, plaintext, new Uint8Array());
  const combined = new Uint8Array(enc.byteLength + ct.byteLength);
  combined.set(new Uint8Array(enc), 0);
  combined.set(new Uint8Array(ct), enc.byteLength);
  return { keypairId: keypair.id, sealedSecretValue: bytesToBase64(combined) };
}

export async function createBrowserbaseSecret(secretKey: string, value: string) {
  const sealed = await sealBrowserbaseSecret(value);
  const secret = await request('/v1/secrets', {
    method: 'POST',
    body: JSON.stringify({
      secretKey,
      keypairId: sealed.keypairId,
      sealedSecretValue: sealed.sealedSecretValue,
    }),
  });
  if (!secret?.id || !secret?.secretKey) throw new Error('Browser credential service did not create the secret.');
  return { id: String(secret.id), secretKey: String(secret.secretKey) };
}

export async function deleteBrowserbaseSecret(secretId: string) {
  if (!secretId) return;
  await request(`/v1/secrets/${encodeURIComponent(secretId)}`, { method: 'DELETE' });
}

export function browserbaseCredentialServiceConfigured() {
  return !!apiKey();
}
