// Server-only credential encryption. No plaintext fallback. Provision a random
// 32-byte base64 AES key as IFUND_CONNECTION_SECRET_KEY in Base44 backend secrets.
// Never send the key, plaintext, or decrypted value to a browser or an LLM.
function loadKeyBytes(): Uint8Array {
  const encoded = Deno.env.get('IFUND_CONNECTION_SECRET_KEY') || '';
  if (!encoded) throw new Error('secure_store_unavailable');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)); }
  catch { throw new Error('secure_store_unavailable'); }
  if (bytes.length !== 32) throw new Error('secure_store_unavailable');
  return bytes;
}

async function cryptoKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', loadKeyBytes(), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function encryptConnectionSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), bytes);
  return 'enc:v1:' + toBase64(iv) + ':' + toBase64(new Uint8Array(encrypted));
}

export async function decryptConnectionSecret(value: string): Promise<string> {
  const parts = String(value || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('invalid_encrypted_credential');
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parts[2]) },
    await cryptoKey(),
    fromBase64(parts[3])
  );
  return new TextDecoder().decode(decrypted);
}
