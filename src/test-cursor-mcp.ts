import { startExtensionServer } from './server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

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

async function testServer() {
  log('Starting test...');
  
  // Start server
  const server = await startExtensionServer({
    fixedPort: 54321
  });
  log(`Server started on port ${server.port}`);

  try {
    // Create MCP client
    log('Creating MCP client...');
    const client = new Client({
      name: "test-client",
      version: "1.0.0"
    });

    // Connect using SSE transport
    log(`Connecting to server on port ${server.port}...`);
    const transport = new SSEClientTransport(
      new URL(`http://localhost:${server.port}/sse`)
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
    log('Test completed successfully');
    await transport.close();
    await server.cleanup();
    process.exit(0);
  } catch (error) {
    log(`Test failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    if (error instanceof Error && error.stack) {
      log('Error stack:', 'error');
      console.error(error.stack);
    }
    await server.cleanup();
    process.exit(1);
  }
}

// Run the test
testServer().catch(error => {
  log(`Test failed: ${error}`, 'error');
  process.exit(1);
}); 