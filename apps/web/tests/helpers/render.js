import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

// Shared harness for real component render tests. esbuild is already a build
// dependency, so this adds no new tooling. React stays external so the
// renderer and the component under test share one React instance.
const webRoot = fileURLToPath(new URL("../../", import.meta.url));
export const cacheDir = path.join(webRoot, "node_modules", ".cache", "ifund-render-tests");
let counter = 0;

// Some presentational modules read `window` at import time (e.g. image.jsx
// checks whether it is inside an iframe). Node has no window, so provide the
// few globals those modules touch before importing the bundle.
function stubBrowserGlobals() {
  if (typeof globalThis.window === "undefined") {
    const win = {
      self: undefined, top: undefined, location: { href: "http://localhost/", origin: "http://localhost" },
    };
    win.self = win;
    win.top = win;
    globalThis.window = win;
  }
}

/** Bundle one component entry and return its module. */
export async function loadComponent(entry) {
  mkdirSync(cacheDir, { recursive: true });
  const name = path.basename(entry).replace(/\W+/g, "_");
  const outfile = path.join(cacheDir, `${++counter}-${name}.mjs`);
  await build({
    entryPoints: [path.join(webRoot, entry)],
    outfile,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "neutral",
    alias: { "@": path.join(webRoot, "src") },
    external: ["react", "react-dom", "react/jsx-runtime", "react-router", "react-router-dom"],
    logLevel: "silent",
  });
  stubBrowserGlobals();
  return import(pathToFileURL(outfile).href);
}
