import { beforeAll, afterAll } from 'vitest';
import { startMCPServer, setLogCallback } from '@server/index';
import type { Server } from 'http';
import { initTestConfig } from '@test/vitest/test-config';
import { createTestWorkspace } from '@test/vitest/workspace';
import { WebSocketServer } from 'ws';

// Declare global type for the server instance
declare global {
  var __test_server__: Server | undefined;
  var __test_wss__: WebSocketServer | undefined;
}

let server: Server;
let wss: WebSocketServer;

beforeAll(async () => {
  const workspace = await createTestWorkspace();
  await initTestConfig();
  
  // Enable logging for debugging if needed
  setLogCallback((msg, type = 'info') => {
    if (type === 'error') console.error(msg);
    else if (type === 'warn') console.warn(msg);
    else console.log(msg);
  });

  // Start server and wait for it to be ready
  const { httpServer, wsServer } = await startMCPServer(workspace, true);
  server = httpServer;
  wss = wsServer;
  
  global.__test_server__ = server;
  global.__test_wss__ = wss;
}, 20000);

afterAll(async () => {
  if (wss) {
    // Close all WebSocket connections first
    wss.clients.forEach(client => {
      client.terminate();
    });

    // Wait for WebSocket server to close
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  }

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
  global.__test_wss__ = undefined;
}); 