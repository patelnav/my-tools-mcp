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
    // Timeouts according to our rules (all values must be powers of 10 * 2)
    testTimeout: 20000,   // 20s for individual tests (increased from 2s for tool discovery)
    hookTimeout: 2000,    // 2s for hooks
    teardownTimeout: 200, // 200ms for cleanup
    // Setup files
    setupFiles: ['src/__tests__/vitest/setup.ts'],
    // Environment
    environment: 'node',
    // Include only vitest tests
    include: [
      'src/__tests__/vitest/**/*.test.ts',
      'src/__tests__/vitest/docs/**/*.test.ts'
    ],
    exclude: [
      'src/__tests__/vscode/**/*',
      '**/node_modules/**',
      '.vscode-test/**'
    ],
    // Use verbose reporter for detailed output
    reporters: 'verbose'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/__tests__'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@server': path.resolve(__dirname, './src/server'),
      '@types': path.resolve(__dirname, './src/types'),
      '@shared': path.resolve(__dirname, './src/__tests__/shared'),
      '@vitest': path.resolve(__dirname, './src/__tests__/vitest'),
      '@vscode': path.resolve(__dirname, './src/__tests__/vscode'),
      '@fixtures': path.resolve(__dirname, './src/__tests__/fixtures'),
      '@panel': path.resolve(__dirname, './src/panel'),
      'vscode': path.resolve(__dirname, './src/__tests__/mocks/vscode.ts')
    }
  }
}); 