import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Enforced for EVERY production Vite build (including Base44's own build),
// independent of npm scripts or optional release commands.
function blockCyclicProductionChunks() {
  return {
    name: "ifund-block-cyclic-production-chunks",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(asset => asset.type === "chunk");
      const known = new Set(chunks.map(chunk => chunk.fileName));
      const graph = new Map(chunks.map(chunk => [
        chunk.fileName,
        chunk.imports.filter(name => known.has(name)),
      ]));
      const settled = new Set();
      const active = [];
      const visit = (name) => {
        const cycleStart = active.indexOf(name);
        if (cycleStart >= 0) {
          this.error("IFund build blocked: circular JavaScript chunk import " +
            active.slice(cycleStart).concat(name).join(" -> "));
        }
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    blockCyclicProductionChunks(),
  ],
  optimizeDeps: {
    include: [
      '@reown/appkit',
      '@reown/appkit-adapter-ethers',
      '@reown/appkit-adapter-solana',
      '@reown/appkit-adapter-bitcoin',
      '@reown/appkit/networks',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // React, ReactDOM, scheduler and React Router are a single runtime.
          // Splitting them separately introduced a circular ES module import:
          // react-dom -> react-router -> react-dom. In production it failed
          // before React mounted with "reading 'useLayoutEffect'" (blank site).
          // Keep the framework runtime together so initialization is ordered.
          if (/(?:\x2f|\\)node_modules(?:\x2f|\\)(?:react|react-dom|react-router|react-router-dom|scheduler)(?:\x2f|\\)/.test(id) ||
              id.includes('node_modules/@remix-run/')) return 'react-runtime';
          if (id.includes('@reown/appkit-adapter-ethers') || id.includes('/ethers/')) return 'reown-ethers';
          if (id.includes('@solana/')) return 'reown-solana';
          if (id.includes('@reown/appkit-adapter-bitcoin')) return 'reown-bitcoin';
          if (id.includes('@walletconnect')) return 'walletconnect';
          if (id.includes('@reown/appkit-ui') || id.includes('@reown/appkit-scaffold-ui')) return 'reown-runtime';
          if (id.includes('@reown/appkit-controllers')) return 'reown-runtime';
          if (id.includes('@reown/appkit')) return 'reown-runtime';
          if (id.includes('@coinbase/wallet-sdk') || id.includes('@cbhq/')) return 'coinbase-wallet';
          if (id.includes('@base-org/') || id.includes('@base/')) return 'base-wallet';
          // Do not split viem's own interdependent ESM graph into separate
          // chunks: it causes circular imports and TDZ runtime crashes on
          // campaign discovery. One crypto core chunk initializes atomically.
          if (id.includes('@noble/') || id.includes('ox-') || id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'ui-crypto-primitives';
          if (id.includes('viem')) return 'viem-runtime';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'react-dom';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'react-router';
          if (id.includes('three')) return 'three';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'recharts';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'framer';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('lodash')) return 'lodash';
          if (id.includes('react-leaflet') || id.includes('leaflet')) return 'leaflet';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('@hello-pangea')) return 'dnd';
          if (id.includes('html2canvas')) return 'html2canvas';
          if (id.includes('jspdf')) return 'jspdf';
        },
      },
    },
  },
});