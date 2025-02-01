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
  if (!server) return;
  return new Promise<void>((resolve) => {
    server?.close(() => {
      server = undefined;
      global.server = undefined;
      resolve();
    });
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