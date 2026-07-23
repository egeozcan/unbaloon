/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/unbaloon/',
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'icon.svg',
      ],
      manifest: {
        name: 'Unbaloon',
        short_name: 'Unbaloon',
        description: 'A playful balloon-popping game for young children.',
        lang: 'en',
        start_url: '/unbaloon/',
        scope: '/unbaloon/',
        theme_color: '#87CEEB',
        background_color: '#87CEEB',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
