import type { Server } from 'net';
import { createServer } from 'net';

export const PRODUCTION_ORIGINS = new Set([
  'vscode-webview://'
]);

export const TEST_ORIGINS = new Set([
  'vscode-test://mcp-tools',
  'vscode-webview://',
  'vscode-webview-test://',
  'null',
  'http://localhost',
  'https://localhost'
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
const VSCODE_TEST_PORT = 54321; // Fixed port for VS Code tests

// Get a random port within our range
function getRandomPort(start: number = MCP_PORT_START, end: number = MCP_PORT_END): number {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

// Try to bind to a specific port
async function tryPort(port: number): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const server: Server = createServer();
      server.unref();
      server.on('error', reject);
      server.listen(port, () => {
        server.close(() => resolve());
      });
    });
    return true;
  } catch {
    return false;
  }
}

// Find an available port in the MCP range
async function findAvailablePort(preferredPort?: number, isVSCodeTest = false): Promise<number> {
  // For VS Code tests, always try to use the fixed test port first
  if (isVSCodeTest) {
    if (await tryPort(VSCODE_TEST_PORT)) {
      return VSCODE_TEST_PORT;
    }
    // If fixed port is unavailable, try the next few ports
    for (let port = VSCODE_TEST_PORT + 1; port <= VSCODE_TEST_PORT + 5; port++) {
      if (await tryPort(port)) {
        return port;
      }
    }
  }

  // For other cases, try preferred port first
  if (preferredPort && preferredPort >= MCP_PORT_START && preferredPort <= MCP_PORT_END) {
    if (await tryPort(preferredPort)) {
      return preferredPort;
    }
  }

  // Create a shuffled array of remaining ports
  const allPorts = Array.from(
    { length: MCP_PORT_END - MCP_PORT_START + 1 },
    (_, i) => MCP_PORT_START + i
  ).filter(p => p !== VSCODE_TEST_PORT); // Exclude VS Code test port from random selection
  
  // Shuffle ports
  for (let i = allPorts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPorts[i], allPorts[j]] = [allPorts[j], allPorts[i]];
  }

  // Try each port
  for (const port of allPorts) {
    if (await tryPort(port)) {
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${MCP_PORT_START}-${MCP_PORT_END}`);
}

export async function getServerConfig(isTest = false): Promise<ServerConfig> {
  // Detect if we're in VS Code test environment
  const isVSCodeTest = isTest && process.env.VSCODE_TEST === 'true';
  
  // For Vitest, use random ports. For VS Code tests, try to use fixed port
  const initialPort = isVSCodeTest ? VSCODE_TEST_PORT : (isTest ? getRandomPort() : MCP_PORT_START);
  const port = await findAvailablePort(initialPort, isVSCodeTest);
  
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