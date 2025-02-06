import { startMcpServer } from './server/mcp';
import type { AddressInfo } from 'net';

// Mock workspace path for testing
process.env.WORKSPACE_PATH = process.cwd();

// Simple logger
function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${type.toUpperCase()}] ${message}`);
}

async function main() {
  try {
    // Start the server
    const server = await startMcpServer(log);
    
    // Get the port number
    const address = server.address() as AddressInfo;
    log(`Server running on port ${address.port}`);

    // Handle shutdown
    process.on('SIGINT', () => {
      log('Shutting down server...');
      server.close(() => {
        log('Server shut down');
        process.exit(0);
      });
    });
  } catch (error) {
    log(`Failed to start server: ${error}`, 'error');
    process.exit(1);
  }
}

main(); 