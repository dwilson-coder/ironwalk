import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built game runs from any folder or static host (itch.io, GitHub Pages, etc).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom'], motion: ['framer-motion'] },
      },
    },
  },
});
