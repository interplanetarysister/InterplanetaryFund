import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { blockCyclicProductionChunks } from './build/guard-cyclic-chunks.js';
export default defineConfig({ plugins: [react(), blockCyclicProductionChunks()], build: { outDir: 'dist' } });
