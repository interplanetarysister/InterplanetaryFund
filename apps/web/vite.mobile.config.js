import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, renameSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

// Independently bundled iOS/Android review entrypoint. This NEVER compiles the
// full website router, PayPal SDK checkout, admin pages or paid subscription UI.
// Deliberately avoid copying the full public archive into app binaries.
const root = fileURLToPath(new URL(".", import.meta.url));
function finalizeNativeStoreBundle() {
  return {
    name: "ifund-mobile-standalone-entry",
    apply: "build",
    closeBundle() {
      const out = resolve(root, "dist-mobile");
      const generated = resolve(out, "mobile.html");
      if (!existsSync(generated))
        throw new Error("Mobile build failed to produce its verified HTML entry.");
      renameSync(generated, resolve(out, "index.html"));
      for (const file of ["ifund-logo.jpg", "mobile-offline.html"])
        copyFileSync(resolve(root, "public", file), resolve(out, file));
    },
  };
}
export default defineConfig({
  plugins: [react(), finalizeNativeStoreBundle()],
  publicDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./mobile.html", import.meta.url)) },
  },
});
