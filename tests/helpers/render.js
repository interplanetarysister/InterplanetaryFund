import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

// Render harness for the root app. The root app is what Cloudflare currently
// deploys, so it needs the same runtime coverage the branded frontend has.
// esbuild is already a root dependency; react and react-router stay external so
// the renderer and the component share one instance.
const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = path.join(root, "node_modules", ".cache", "ifund-root-render");
let counter = 0;

// Some modules read `window` at import time; Node has none.
function stubBrowserGlobals() {
  if (typeof globalThis.window === "undefined") {
    const win = {
      self: undefined,
      top: undefined,
      location: {
        href: "http://localhost/",
        origin: "http://localhost",
        pathname: "/",
      },
      matchMedia: () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }),
    };
    win.self = win;
    win.top = win;
    globalThis.window = win;
  }
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  }
}

/** Bundle one entry module from the root app and return it. */
export async function loadModule(entry) {
  mkdirSync(cacheDir, { recursive: true });
  const name = path.basename(entry).replace(/\W+/g, "_");
  const outfile = path.join(cacheDir, `${++counter}-${name}.mjs`);
  await build({
    entryPoints: [path.join(root, entry)],
    outfile,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "neutral",
    loader: { ".jsx": "jsx", ".js": "jsx" },
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-router",
      "react-router-dom",
    ],
    logLevel: "silent",
  });
  stubBrowserGlobals();
  return import(pathToFileURL(outfile).href);
}
