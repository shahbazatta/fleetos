import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',  ws: true },
      //'/api': { target: 'https://api.fleet.cloudnext.solutions:3001', changeOrigin: true },
      //'/ws':  { target: 'ws://api.fleet.cloudnext.solutions:3001',  ws: true },
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    rollupOptions: {
      external: ['@deck.gl/widgets'],
    },
  },
});
