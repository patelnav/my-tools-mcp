import { beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { startMCPServer, setLogCallback } from '@server/index';
import type { Server } from 'http';
import path from 'path';
import { initTestConfig } from './test-config';
import http from 'http';

// Declare global type for the server instance
declare global {
  var __test_server__: Server | undefined;
}

// Helper function to check if server is ready
async function waitForServerReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, {
      timeout: 1000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });
  });
}

// Helper function to close server
async function closeServer() {
  if (!global.__test_server__) return;
  
  return new Promise<void>((resolve) => {
    // Force close any remaining connections immediately
    global.__test_server__?.getConnections((err, count) => {
      if (err) {
        console.error('Error getting connections:', err);
      } else if (count > 0) {
        console.log(`Forcing close of ${count} remaining connections`);
        const listeners = global.__test_server__?.listeners('connection') as ((...args: any[]) => void)[];
        listeners.forEach(listener => {
          global.__test_server__?.removeListener('connection', listener);
        });
      }
    });
    
    const closeTimeout = setTimeout(() => {
      console.log('Force closing server - timeout reached');
      global.__test_server__ = undefined;
      resolve();
    }, 500);

    global.__test_server__?.close(() => {
      clearTimeout(closeTimeout);
      global.__test_server__ = undefined;
      resolve();
    });
  });
}

async function setupServer() {
  console.log('Setting up test server...');
  
  // Always start with a clean server
  await closeServer();
  setLogCallback(() => {});
  
  const config = await initTestConfig();
  const testWorkspacePath = path.resolve(__dirname, '../..');
  
  const server = await startMCPServer(testWorkspacePath, true);
  
  // Wait for server to be ready before setting global
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Server failed to start within 10 seconds'));
    }, 10000);

    const checkReady = async () => {
      if (!server.listening) {
        server.once('listening', checkReady);
        return;
      }

      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Invalid server address'));
        return;
      }

      const isReady = await waitForServerReady(address.port);
      if (isReady) {
        clearTimeout(timeoutId);
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };

    checkReady();
  });

  // Only set global after server is confirmed ready
  global.__test_server__ = server;
  console.log('Test server ready');
  return server;
}

// Set up fresh server before each test
beforeEach(async () => {
  await setupServer();
}, 10000);

// Clean up after each test
afterEach(async () => {
  await closeServer();
}, 5000); 