import fs from "node:fs";

const source = fs.readFileSync("convex/security.ts", "utf8");

const required = [
  "export const getAdminSetting = query({",
  "await requireAuth(ctx);",
  "const normalizedKey = args.key.trim().toLowerCase();",
  "This admin setting cannot be read through the public query.",
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing admin-settings security guard: ${fragment}`);
  }
}

const sensitiveKeyPattern = /pin|password|secret|token|credential|private.?key|api.?key/i;
if (!sensitiveKeyPattern.test(source)) {
  throw new Error("Admin-settings sensitive-key denylist is missing.");
}

const queryStart = source.indexOf("export const getAdminSetting = query({");
const queryEnd = source.indexOf("export const", queryStart + 1);
const queryBody = source.slice(queryStart, queryEnd === -1 ? undefined : queryEnd);

if (!queryBody.includes("await requireAuth(ctx);")) {
  throw new Error("getAdminSetting must authenticate before reading adminSettings.");
}
if (!queryBody.includes("normalizedKey")) {
  throw new Error("getAdminSetting must normalize the requested key before sensitivity checks.");
}

console.log("Admin settings security contract passed.");
