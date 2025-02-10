import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { createServer } from './server/mcp';

// Simple logger
function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${type.toUpperCase()}] ${message}`);
}

interface TextContent {
  type: "text";
  text: string;
}

interface ToolResponse {
  content: TextContent[];
}

async function startServer() {
  const app = express();
  const PORT = 54321;
  const { server } = await createServer();
  let transport: SSEServerTransport;

  app.get("/sse", async (req, res) => {
    log("Received SSE connection");
    transport = new SSEServerTransport("/message", res);
    await server.connect(transport);

    req.on('close', async () => {
      log("Connection closed");
      await transport.close();
    });
  });

  app.post("/message", async (req, res) => {
    log("Received message");
    if (!transport) {
      log("No transport available", 'error');
      res.status(500).end();
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  return new Promise<void>((resolve) => {
    const httpServer = app.listen(PORT, () => {
      log(`Server is running on http://localhost:${PORT}/sse`);
      resolve();
    });

    // Store server reference for cleanup
    process.on('SIGINT', async () => {
      log('Shutting down server...');
      if (transport) {
        await transport.close();
      }
      httpServer.close();
      process.exit(0);
    });
  });
}

async function main() {
  try {
    // Start the server first
    log('Starting server...');
    await startServer();

    // Create MCP client
    log('Creating MCP client...');
    const client = new Client({
      name: "test-client",
      version: "1.0.0"
    });

    // Connect using SSE transport
    const port = 54321; // Match the server port
    log(`Connecting to server on port ${port}...`);
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${port}/sse`)
    );

    await client.connect(transport);
    log('Client connected successfully');

    // Test list-available-tools
    log('Testing list-available-tools...');
    const toolsResponse = await client.callTool({
      name: 'list-available-tools',
      arguments: {}
    }) as ToolResponse;
    
    const tools = JSON.parse(toolsResponse.content[0].text);
    log(`Available tools: ${JSON.stringify(tools, null, 2)}`);

    // Test get-tool-info for each tool
    log('\nTesting get-tool-info for each tool...');
    for (const toolName of tools) {
      log(`\nGetting info for tool: ${toolName}`);
      const infoResponse = await client.callTool({
        name: 'get-tool-info',
        arguments: { toolName }
      }) as ToolResponse;
      log(`Tool info: ${infoResponse.content[0].text}`);
    }

    // Clean up
    log('Test completed, cleaning up...');
    await transport.close();
    process.exit(0);
  } catch (error) {
    log(`Test failed: ${error}`, 'error');
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  log('Shutting down...');
  process.exit(0);
});

main(); 