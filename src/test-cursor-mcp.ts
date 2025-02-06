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

    // Create MCP client (simulating Cursor's agent)
    log('Creating Cursor agent client...');
    const client = new Client(
      {
        name: "cursor-agent",
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
    for (const toolName of tools.slice(0, 5)) { // Test first 5 tools for brevity
      log(`\nGetting info for tool: ${toolName}`);
      const infoResponse = await client.callTool({
        name: 'get-tool-info',
        arguments: { toolName }
      }) as ToolResponse;
      log(`Tool info: ${infoResponse.content[0].text}`);
    }

    // Clean up
    log('\nTest completed, cleaning up...');
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