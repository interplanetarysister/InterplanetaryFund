import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/interplanetary-fund-backend/",
  define: {
    "process.env.CONVEX_URL": JSON.stringify(process.env.VITE_CONVEX_URL),
  },
  // Modern build target — smaller output, faster parsing on Galaxy A16
  esbuild: {
    target: "es2020",
  },
  build: {
    // Disable source maps — prevents code recovery from production build
    sourcemap: false,
    // Aggressive minification with esbuild (bundled, no extra deps)
    minify: "esbuild",
    // Target modern browsers for smaller output
    target: "es2020",
    // CSS code splitting
    cssCodeSplit: true,
    // Smaller chunks for faster initial load on mobile
    chunkSizeWarningLimit: 100,
    esbuildOptions: {
      drop: ["console", "debugger"],
      minify: true,
      legalComments: "none",
    },
    rollupOptions: {
      output: {
        // Add copyright watermark in bundle
        banner: "/* Interplanetary Fund © 2026 Michelle Rogers. All Rights Reserved. PROPRIETARY. */",
        // Manual chunk splitting — separates vendor code for better caching
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "convex-vendor": ["convex/react", "convex"],
        },
      },
    },
  },
  // Dev server optimizations for local testing on Galaxy A16
  server: {
    host: true,
    port: 5173,
  },
});
