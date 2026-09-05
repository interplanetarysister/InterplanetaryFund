import fs from "node:fs";
import { pathToFileURL } from "node:url";

const sourcePath = "scripts/apply-complete-admin-auth-surface.mjs";
let source = fs.readFileSync(sourcePath, "utf8");
const start = source.indexOf("const verifier = `");
const endMarker = "write('scripts/verify-complete-admin-auth-surface.mjs', verifier);";
const endStart = source.indexOf(endMarker, start);
if (start < 0 || endStart < 0) {
  throw new Error("Verifier-generation block not found in transformer");
}
const end = endStart + endMarker.length;
source = source.slice(0, start) + source.slice(end);
const runnablePath = "/tmp/apply-complete-admin-auth-surface-runtime.mjs";
fs.writeFileSync(runnablePath, source);
await import(pathToFileURL(runnablePath).href + `?run=${Date.now()}`);
