import { getServerConfig } from '@server/config';

// Get a test port from our MCP range
let testPort: number | undefined;
let lastUsedPort: number | undefined;

export async function initTestConfig() {
  // If we have a last used port, try to get the next available port
  const config = await getServerConfig(true);
  
  if (lastUsedPort && config.port === lastUsedPort) {
    // Try again to get a different port
    const newConfig = await getServerConfig(true);
    testPort = newConfig.port;
  } else {
    testPort = config.port;
  }
  
  lastUsedPort = testPort;
  return config;
}

export const TEST_CONFIG = {
  server: {
    get port() {
      if (testPort === undefined) {
        throw new Error('Test port not initialized. Call initTestConfig() first.');
      }
      return testPort;
    },
    host: 'localhost'
  },
  websocket: {
    origin: 'vscode-test://mcp-tools'
  }
} as const; 