import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    "process.env.CONVEX_URL": JSON.stringify(process.env.VITE_CONVEX_URL),
  },
  esbuild: {
    target: "es2020",
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 100,
    esbuildOptions: {
      drop: ["console", "debugger"],
      minify: true,
      legalComments: "none",
    },
    rollupOptions: {
      output: {
        banner: "/* Interplanetary Fund © 2026 Michelle Rogers. All Rights Reserved. PROPRIETARY. */",
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "convex-vendor": ["convex/react", "convex"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
