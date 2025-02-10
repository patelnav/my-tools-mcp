import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { VSCodeMessage } from '@/types/index';

interface TextContent {
  type: "text";
  text: string;
}

interface ToolResponse {
  content: TextContent[];
}

export class MCPClient {
  private client: Client;
  private transport: SSEClientTransport | null = null;
  private vscode: {
    postMessage: (message: VSCodeMessage) => void;
  };

  constructor(vscode: { postMessage: (message: VSCodeMessage) => void }) {
    this.vscode = vscode;
    this.client = new Client({
      name: "mcp-tools-webview",
      version: "1.0.0"
    });
  }

  async connect(serverPort: number): Promise<void> {
    try {
      // Create SSE transport
      this.transport = new SSEClientTransport(
        new URL(`http://localhost:${serverPort}/sse`)
      );

      // Connect client
      await this.client.connect(this.transport);
      
      // Notify extension that we're connected
      this.vscode.postMessage({ 
        type: 'MCP_STATUS', 
        status: 'connected' 
      });
    } catch (error) {
      console.error('Failed to connect MCP client:', error);
      this.vscode.postMessage({ 
        type: 'MCP_STATUS', 
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listTools(projectPath?: string): Promise<string[]> {
    try {
      const response = await this.client.callTool({
        name: 'list-available-tools',
        arguments: { projectPath }
      }) as ToolResponse;

      return JSON.parse(response.content[0].text);
    } catch (error) {
      console.error('Failed to list tools:', error);
      throw error;
    }
  }

  async getToolInfo(toolName: string, projectPath?: string): Promise<any> {
    try {
      const response = await this.client.callTool({
        name: 'get-tool-info',
        arguments: { toolName, projectPath }
      }) as ToolResponse;

      return JSON.parse(response.content[0].text);
    } catch (error) {
      console.error('Failed to get tool info:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.vscode.postMessage({ 
        type: 'MCP_STATUS', 
        status: 'disconnected' 
      });
    }
  }
} 