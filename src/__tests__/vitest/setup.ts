import { beforeAll, afterAll } from 'vitest';
import { startExtensionServer } from '@server/index';
import type { Server } from 'http';
import { initTestConfig } from '@test/vitest/test-config';
import { createTestWorkspace } from '@test/vitest/workspace';
import { initializeLogging } from '@/utils/logging';
import { TIMEOUTS } from '@/constants';

// Declare global type for the server instance
declare global {
  var __test_server__: Server | undefined;
}

let server: Server;
let activeConnections = new Set<any>();

beforeAll(async () => {
  const workspace = await createTestWorkspace();
  await initTestConfig();
  
  // Initialize logging for tests
  initializeLogging(undefined, undefined, true);

  // Try to start server with retries
  let retryCount = 0;
  const maxRetries = 3;
  let lastError: Error | undefined;

  // First ensure any existing server is cleaned up
  if (global.__test_server__) {
    await new Promise<void>((resolve) => {
      global.__test_server__?.close(() => resolve());
    });
    global.__test_server__ = undefined;
  }

  while (retryCount < maxRetries) {
    try {
      // Start server with a dynamic port for tests
      const extensionServer = await startExtensionServer({
        workspacePath: workspace,
        portRange: {
          start: 54321,
          end: 54421
        }
      });

      // Track connections for cleanup
      extensionServer.httpServer.on('connection', (conn) => {
        activeConnections.add(conn);
        conn.on('close', () => activeConnections.delete(conn));
      });

      // Wait for server to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server failed to start within timeout'));
        }, TIMEOUTS.SERVER_START);

        extensionServer.httpServer.once('listening', () => {
          clearTimeout(timeout);
          resolve();
        });

        extensionServer.httpServer.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      server = extensionServer.httpServer;
      global.__test_server__ = server;
      return;
    } catch (err) {
      lastError = err as Error;
      retryCount++;
      console.log(`Server start attempt ${retryCount} failed:`, err);
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Failed to start server after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}, 20000);

afterAll(async () => {
  if (server) {
    // Close all tracked connections first
    for (const conn of activeConnections) {
      conn.destroy();
    }
    activeConnections.clear();

    // Wait for HTTP server to close
    await new Promise<void>((resolve, reject) => {
      const forceCloseTimeout = setTimeout(() => {
        console.log('Force closing server after timeout');
        server.closeAllConnections?.();
        resolve();
      }, TIMEOUTS.CONNECTION);

      server.close((err) => {
        clearTimeout(forceCloseTimeout);
        if (err) {
          console.error('Error closing server:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Clear the global reference
    global.__test_server__ = undefined;
  }
}, 5000); 