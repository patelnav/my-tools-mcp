import { startExtensionServer } from './server/index.js';

// Mock workspace path for testing
process.env.WORKSPACE_PATH = process.cwd();

// Simple logger
function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${type.toUpperCase()}] ${message}`);
}

async function startServer() {
  try {
    // Start server with fixed port for testing
    const server = await startExtensionServer({
      fixedPort: 54321
    });
    log(`Server started on port ${server.port}`);

    // Handle cleanup on interrupt
    process.on('SIGINT', async () => {
      log('Shutting down server...');
      await server.cleanup();
      process.exit(0);
    });

    log('Server ready - Press Ctrl+C to stop');
  } catch (error) {
    log(`Failed to start server: ${error}`, 'error');
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  log(`Unhandled error: ${error}`, 'error');
  process.exit(1);
}); 