import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../convex/security.ts", import.meta.url), "utf8");

const required = [
  'import { query, mutation, internalMutation } from "./_generated/server";',
  'export const initAdminPin = internalMutation({',
  'if (args.pin.length < 4)',
  'export const getAdminSetting = query({',
  'await requireAuth(ctx);',
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Admin security contract missing required guard: ${fragment}`);
  }
}

if (source.includes('export const initAdminPin = mutation({')) {
  throw new Error("initAdminPin must not remain a public mutation.");
}

if (!source.includes('/(pin|password|secret|token|credential|private.?key|api.?key)/i.test(normalizedKey)')) {
  throw new Error("getAdminSetting must retain its sensitive-key denylist.");
}

console.log("Admin PIN security verification passed.");
