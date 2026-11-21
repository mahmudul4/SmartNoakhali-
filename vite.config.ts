import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'logo.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'sw-push.js',
        ],
        manifest: {
          id: '/',
          name: 'Smart Noakhali — স্মার্ট নোয়াখালী',
          short_name: 'স্মার্ট নোয়াখালী',
          description:
            'নোয়াখালীর সকল জরুরী সেবা, জনপ্রতিনিধি, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।',
          theme_color: '#0f5132',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-push.js'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/downloads/**', '**/logo.png', '**/icons/categories/**'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/downloads\//],
          runtimeCaching: [
            {
              urlPattern: /^\/icons\/categories\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'category-icons-cache',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*%2Fcategories%2F.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'category-custom-icons-cache',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-router';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
