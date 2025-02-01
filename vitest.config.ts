import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially
    sequence: {
      concurrent: false,
    },
    // Longer timeout for integration tests
    testTimeout: 10000,
    // Global setup and teardown
    globalSetup: './src/__tests__/setup.ts',
    // Environment setup
    environment: 'node',
    // Include source maps
    include: ['src/__tests__/**/*.test.ts'],
  },
}); 