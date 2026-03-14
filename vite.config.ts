/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/unbaloon/',
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
