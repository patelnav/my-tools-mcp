import { afterAll, beforeAll } from 'vitest';
import { startMCPServer } from '@server/index';
import type { Server } from 'http';

let server: Server;

export async function setup() {
  // Start the MCP server before all tests
  server = startMCPServer();
}

export async function teardown() {
  // Close the server after all tests
  return new Promise<void>((resolve) => {
    server.close(() => {
      console.log('Test server closed');
      resolve();
    });
  });
} 