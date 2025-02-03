import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Run tests sequentially
    sequence: {
      concurrent: false,
      shuffle: false
    },
    // Use forks for better process isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        // Ensure complete isolation between test files
        isolate: true
      }
    },
    // Timeouts
    testTimeout: 5000,
    hookTimeout: 5000,
    teardownTimeout: 5000,
    // Setup files
    setupFiles: ['src/__tests__/setup.ts'],
    // Environment
    environment: 'node',
    // Include only server/backend tests
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/test/**/*', '**/node_modules/**', '.vscode-test/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './src/server'),
      '@panel': path.resolve(__dirname, './src/panel'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@test': path.resolve(__dirname, './src/__tests__'),
    },
  },
}); 