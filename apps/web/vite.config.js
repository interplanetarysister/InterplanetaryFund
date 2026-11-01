import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Enforced for every production build: fail if JavaScript chunks import each
// other in a cycle (kept from the original app, which hit a blank-site bug).
function blockCyclicProductionChunks() {
  return {
    name: "ifund-block-cyclic-production-chunks",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((asset) => asset.type === "chunk");
      const known = new Set(chunks.map((chunk) => chunk.fileName));
      const graph = new Map(chunks.map((chunk) => [chunk.fileName, chunk.imports.filter((name) => known.has(name))]));
      const settled = new Set();
      const active = [];
      const visit = (name) => {
        const cycleStart = active.indexOf(name);
        if (cycleStart >= 0) this.error("IFund build blocked: circular JavaScript chunk import " + active.slice(cycleStart).concat(name).join(" -> "));
        if (settled.has(name)) return;
        active.push(name);
        for (const dependency of graph.get(name) || []) visit(dependency);
        active.pop();
        settled.add(name);
      };
      for (const chunk of chunks) visit(chunk.fileName);
    },
  };
}

export default defineConfig({
  plugins: [react(), blockCyclicProductionChunks()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React, ReactDOM, scheduler and React Router stay one runtime chunk.
          if (/[\\/]node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react-runtime";
          if (id.includes("@supabase")) return "supabase";
        },
      },
    },
  },
});
