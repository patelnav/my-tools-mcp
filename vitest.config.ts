import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Run tests sequentially
    sequence: {
      concurrent: false,
    },
    // Longer timeout for integration tests
    testTimeout: 10000,
    // Global setup and teardown
    setupFiles: ['./src/__tests__/setup.ts'],
    // Environment setup
    environment: 'node',
    // Include source maps
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './src/server'),
      '@panel': path.resolve(__dirname, './src/panel'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
}); 