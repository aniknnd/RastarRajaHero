import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Serve the app under /bikeracingnnd (dev + build), e.g. http://127.0.0.1:3005/bikeracingnnd
    base: '/bikeracingnnd/',
    plugins: [
      {
        // Redirect the slash-less base URL to the trailing-slash form in dev.
        name: 'redirect-base-no-slash',
        configureServer(server): void {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/bikeracingnnd') {
              req.url = '/bikeracingnnd/';
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    build: {
      // Three.js alone is ~585 kB raw (~147 kB gzipped); a vendor chunk that
      // size is expected for a WebGL game, so raise the reporter's threshold.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Split the heavy, rarely-changing vendor code (Three.js, React) into
          // its own long-term-cacheable chunks instead of one giant app bundle.
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/three/')) return 'three';
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3005,
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
