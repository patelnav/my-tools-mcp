import { beforeAll, afterAll } from 'vitest';
import { startExtensionServer } from '@server/index';
import type { Server } from 'http';
import { initTestConfig } from '@test/vitest/test-config';
import { createTestWorkspace } from '@test/vitest/workspace';
import { initializeLogging } from '@/utils/logging';

// Declare global type for the server instance
declare global {
  var __test_server__: Server | undefined;
}

let server: Server;

beforeAll(async () => {
  const workspace = await createTestWorkspace();
  await initTestConfig();
  
  // Initialize logging for tests
  initializeLogging(undefined, undefined, true);

  // Start server and wait for it to be ready
  const extensionServer = await startExtensionServer({
    workspacePath: workspace,
    fixedPort: 54321
  });
  server = extensionServer.httpServer;
  global.__test_server__ = server;
}, 20000);

afterAll(async () => {
  if (server) {
    // Wait for HTTP server to close and all connections to end
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      
      // Force close any remaining connections
      server.getConnections((err, count) => {
        if (err) console.error('Error getting connections:', err);
        if (count > 0) {
          console.log(`Forcing close of ${count} remaining connections`);
          // @ts-ignore - destroy() exists on socket
          server._connections?.forEach(socket => socket.destroy());
        }
      });
    });
  }

  global.__test_server__ = undefined;
}); 