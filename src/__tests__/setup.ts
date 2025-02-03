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
async function waitForServerReady(port: number, maxAttempts = 50): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, {
          timeout: 1000
        }, (res) => {
          resolve(res.statusCode === 200);
        });

        req.on('error', () => {
          resolve(false);
        });
      });

      if (result) {
        return true;
      }

      // Wait 100ms between attempts
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error checking server health:', error);
    }
  }

  return false;
}

// Helper function to close server
async function closeServer(timeout = 5000): Promise<void> {
  if (!global.__test_server__) return;
  
  return new Promise<void>((resolve, reject) => {
    const forceCloseTimeout = setTimeout(() => {
      console.warn('Force closing server - timeout reached');
      try {
        global.__test_server__?.close();
      } catch (error) {
        console.error('Error force closing server:', error);
      }
      global.__test_server__ = undefined;
      resolve();
    }, timeout);

    try {
      // Force close any remaining connections
      global.__test_server__?.getConnections((err, count) => {
        if (err) {
          console.error('Error getting connections:', err);
        } else if (count > 0) {
          console.log(`Closing ${count} remaining connections`);
          const listeners = global.__test_server__?.listeners('connection') as ((...args: any[]) => void)[];
          listeners.forEach(listener => {
            global.__test_server__?.removeListener('connection', listener);
          });
        }
      });

      global.__test_server__?.close(() => {
        clearTimeout(forceCloseTimeout);
        global.__test_server__ = undefined;
        resolve();
      });
    } catch (error) {
      clearTimeout(forceCloseTimeout);
      console.error('Error closing server:', error);
      reject(error);
    }
  });
}

async function setupServer(): Promise<Server> {
  console.log('Setting up test server...');
  
  // Always start with a clean server
  await closeServer();
  
  // Disable logging during tests
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
        reject(new Error('Server health check failed'));
      }
    };

    checkReady();
  });

  // Only set global after server is confirmed ready
  global.__test_server__ = server;
  console.log('Test server ready');
  return server;
}

// Set up fresh server before all tests
beforeAll(async () => {
  await setupServer();
}, 15000);

// Clean up after all tests
afterAll(async () => {
  await closeServer();
}, 5000); 