import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Separate reviewed store binary entry point. Do not import the full site App,
// payment SDK, or admin router into the independent native bundle.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./mobile.html", import.meta.url)) },
  },
});
