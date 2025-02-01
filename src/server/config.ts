export const PRODUCTION_ORIGINS = new Set([
  'vscode-webview://'
]);

export const TEST_ORIGINS = new Set([
  'vscode-test://mcp-tools'
]);

// Helper function to validate VS Code webview origins
export function isValidVSCodeWebviewOrigin(origin: string): boolean {
  // VSCode webview origins can be:
  // - vscode-webview://[hash]
  // - vscode-webview-test://[hash]
  return origin.startsWith('vscode-webview://') || 
         origin.startsWith('vscode-webview-test://') ||
         // For development/testing
         origin === 'null' ||
         origin.startsWith('http://localhost:') ||
         origin.startsWith('https://localhost:');
}

export interface ServerConfig {
  port: number;
  host: string;
  allowedOrigins: Set<string>;
  rateLimit: {
    maxRequestsPerMinute: number;
    windowMs: number;
  };
}

// MCP servers use ports in the range 54321-54421
const MCP_PORT_START = 54321;
const MCP_PORT_END = 54421;

// Find the next available port in the MCP range
async function findAvailablePort(startPort: number = MCP_PORT_START): Promise<number> {
  const net = require('net');
  
  function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          server.close();
          resolve(true);
        })
        .listen(port, '127.0.0.1');
    });
  }

  for (let port = startPort; port <= MCP_PORT_END; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available ports in the MCP range');
}

export async function getServerConfig(isTest = false): Promise<ServerConfig> {
  const port = isTest ? 8081 : await findAvailablePort();
  return {
    port,
    host: 'localhost',
    allowedOrigins: isTest ? TEST_ORIGINS : PRODUCTION_ORIGINS,
    rateLimit: {
      maxRequestsPerMinute: 60,
      windowMs: 60000
    }
  };
} 