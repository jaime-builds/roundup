import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Backend dev server. The frontend talks to two prefixes:
//   /auth/*  — authentication routes
//   /api/*   — everything else (projects, lists, items, trash, admin, SSE)
const BACKEND = 'http://127.0.0.1:3001'

export default defineConfig({
  server: {
    port: 5173,
    historyApiFallback: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/auth': { target: BACKEND, changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      // Shell-only caching. API responses are never precached or runtime-cached,
      // and SSE / data requests bypass the service worker via the denylist below.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Roundup',
        short_name: 'Roundup',
        description: 'A self-hosted shared list app.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
