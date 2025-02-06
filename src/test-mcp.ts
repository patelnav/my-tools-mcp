import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { cacheWorkspaceTools } from './server/cache.js';
import { getWorkspacePath } from './utils/workspace.js';

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

async function main() {
  try {
    // Cache tools first
    log('Caching workspace tools...');
    const wsPath = getWorkspacePath();
    await cacheWorkspaceTools(wsPath);
    log('Tools cached successfully');

    // Create FastMCP server
    const server = await import('./server/mcp.js').then(m => m.startMcpServer(log));
    
    // Start server with SSE support
    const port = 8080;
    server.start({
      transportType: "sse",
      sse: {
        endpoint: "/sse",
        port,
      },
    });

    log(`Server running on port ${port}`);

    // Create MCP client
    log('Creating MCP client...');
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0"
      }
    );

    // Connect using SSE transport
    log('Connecting to server...');
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${port}/sse`)
    );

    await client.connect(transport);
    log('Client connected successfully');

    // List available tools
    log('Listing available tools...');
    const toolsResponse = await client.callTool({
      name: 'list-available-tools',
      arguments: {}
    }) as ToolResponse;
    log(`Tools response: ${toolsResponse.content[0].text}`);

    // Get info for each tool
    const tools = JSON.parse(toolsResponse.content[0].text);
    log(`Found tools: ${JSON.stringify(tools, null, 2)}`);

    for (const toolName of tools) {
      log(`Getting info for tool: ${toolName}`);
      const infoResponse = await client.callTool({
        name: 'get-tool-info',
        arguments: { toolName }
      }) as ToolResponse;
      log(`Tool info: ${infoResponse.content[0].text}`);
    }

    // Clean up
    log('Test completed, cleaning up...');
    await transport.close();
    server.stop();
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