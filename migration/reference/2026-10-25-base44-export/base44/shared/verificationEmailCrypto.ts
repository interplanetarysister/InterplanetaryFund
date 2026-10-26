import { secrets } from 'base44:runtime';
// Encryption at rest is mandatory for verification emails. The encryption key
// is configured only in the Base44 secret store, not in source or worker.
const bytes = (text: string) => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
const b64 = (buf: Uint8Array) => btoa(String.fromCharCode(...buf));
async function key() {
  const encoded = String(secrets.get('IFUND_VERIFICATION_EMAIL_KEY') || '').trim();
  let raw;
  try { raw = bytes(encoded); } catch { throw Error('email_key_unavailable'); }
  if (raw.length !== 32) throw Error('email_key_unavailable');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function sealMail(payload: {subject: string; text: string}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = await crypto.subtle.encrypt({name:'AES-GCM',iv}, await key(), data);
  return { ciphertext: b64(new Uint8Array(sealed)), iv: b64(iv) };
}
export async function openMail(row: {ciphertext:string;iv:string}) {
  const raw = await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv)},await key(),bytes(row.ciphertext));
  return JSON.parse(new TextDecoder().decode(raw));
}
