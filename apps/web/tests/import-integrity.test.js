import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
function walk(dir) {
  return readdirSync(dir, { withFileTypes:true }).flatMap(item => {
    const full = join(dir,item.name);
    return item.isDirectory() ? walk(full) : /\.(jsx?|tsx?)$/.test(item.name) ? [full] : [];
  });
}
function targetExists(path) {
  return [path, path+".js", path+".jsx", path+".ts", path+".tsx",
    join(path,"index.js"), join(path,"index.jsx"), join(path,"index.tsx")].some(existsSync);
}
test("all local static imports resolve to source files", () => {
  const missing = [];
  for (const path of walk(root)) {
    const source = readFileSync(path,"utf8");
    const re = /(?:\bfrom\s*|\bimport\s*\()\s*["']([^"']+)["']/g;
    for (const match of source.matchAll(re)) {
      const spec = match[1];
      if (!spec.startsWith("@/") && !spec.startsWith("./") && !spec.startsWith("../")) continue;
      const target = spec.startsWith("@/") ? resolve(root,spec.slice(2)) : resolve(dirname(path),spec);
      if (!targetExists(target)) missing.push(path.slice(root.length+1)+": "+spec);
    }
  }
  assert.deepEqual(missing,[], "Broken local imports prevent a Vite build");
});
