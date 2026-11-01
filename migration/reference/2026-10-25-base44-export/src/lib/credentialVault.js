// Browser-local, owner-unlocked password vault. No plaintext credentials or
// passphrase are sent to IFund backend, agent/chat, URL, storage or logs.
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const b64 = (arr) => btoa(String.fromCharCode(...new Uint8Array(arr)));
const unb64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const ITERATIONS = 310000;
async function derive(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
export async function lockVaultEntry(entry, passphrase) {
  if (!crypto?.subtle || !globalThis.isSecureContext) throw new Error("Encrypted storage requires HTTPS.");
  if (passphrase.length < 12) throw new Error("Use a vault passphrase of at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify({
      username: String(entry.username || "").slice(0, 254),
      password: String(entry.password || "").slice(0, 2048)
    }))
  );
  return { ciphertext: b64(ciphertext), iv: b64(iv), salt: b64(salt), iterations: ITERATIONS, version: 1 };
}
export async function unlockVaultEntry(entry, passphrase) {
  if (!crypto?.subtle || !globalThis.isSecureContext) throw new Error("Encrypted storage requires HTTPS.");
  if (entry.version !== 1 || entry.iterations !== ITERATIONS) throw new Error("Unsupported vault version.");
  try {
    const key = await derive(passphrase, unb64(entry.salt), entry.iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(entry.iv) }, key, unb64(entry.ciphertext)
    );
    const value = JSON.parse(decoder.decode(decrypted));
    if (typeof value.username !== "string" || typeof value.password !== "string") throw Error("Bad content");
    return value;
  } catch { throw new Error("Wrong passphrase or damaged entry. No password was revealed."); }
}
