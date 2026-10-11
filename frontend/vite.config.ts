import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// CesiumJS loads workers, widgets and assets at runtime from CESIUM_BASE_URL.
// Setup follows https://github.com/CesiumGS/cesium-vite-example
const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesiumStatic';

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    entries: ['index.html'],
  },
  build: {
    // Cesium is a single large module; it is lazy-loaded with the map view.
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
