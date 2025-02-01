import { beforeAll, afterAll } from 'vitest';
import { startMCPServer, setLogCallback } from '@server/index';
import type { Server } from 'http';
import path from 'path';
import { initTestConfig } from './test-config';

// Declare global type for the server instance
declare global {
  var server: Server | undefined;
}

// Server instance for the test suite
let server: Server | undefined;

// Helper function to close server
async function closeServer() {
  if (!global.server) return;
  
  return new Promise<void>((resolve) => {
    // Force close any remaining connections
    global.server?.getConnections((err, count) => {
      if (err) {
        console.error('Error getting connections:', err);
      } else if (count > 0) {
        console.log(`Forcing close of ${count} remaining connections`);
        // Destroy all sockets
        const listeners = global.server?.listeners('connection') as ((...args: any[]) => void)[];
        listeners.forEach(listener => {
          global.server?.removeListener('connection', listener);
        });
      }
    });
    
    global.server?.close(() => {
      global.server = undefined;
      resolve();
    });
    
    // Force close after 1 second if graceful close fails
    setTimeout(() => {
      if (global.server) {
        console.log('Force closing server after timeout');
        global.server = undefined;
        resolve();
      }
    }, 1000);
  });
}

async function setupServer() {
  // Silence logs during tests
  setLogCallback(() => {});

  // Make sure any existing server is closed
  await closeServer();
  
  // Initialize test config and start server
  const config = await initTestConfig();
  const testWorkspacePath = path.resolve(__dirname, '../..');
  
  server = await startMCPServer(testWorkspacePath, true);
  global.server = server;
  
  // Wait for server to be ready
  await new Promise<void>((resolve) => {
    if (server?.listening) {
      resolve();
    } else {
      server?.once('listening', () => resolve());
    }
  });

  // Additional wait to ensure server is fully initialized
  await new Promise(resolve => setTimeout(resolve, 100));
}

beforeAll(async () => {
  await setupServer();
});

afterAll(async () => {
  await closeServer();
}); 