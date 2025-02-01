import { getServerConfig } from '@server/config';

let testConfig: Awaited<ReturnType<typeof getServerConfig>> | undefined;

export async function initTestConfig() {
  // Initialize config if not already done
  if (!testConfig) {
    testConfig = await getServerConfig(true);
  }
  return testConfig;
}

export const TEST_CONFIG = {
  server: {
    get port() {
      if (!testConfig) {
        throw new Error('Port not initialized. Call initTestConfig() first.');
      }
      return testConfig.port;
    },
    host: 'localhost'
  },
  websocket: {
    origin: 'vscode-test://mcp-tools'
  }
} as const; 