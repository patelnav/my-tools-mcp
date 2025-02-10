import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ToolInfo } from '@/types/index';
import type { Server } from 'http';
import { logInfo } from '@utils/logging';
import { ERROR_MESSAGES, TIMEOUTS } from '@/constants';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import { TEST_MONOREPO_PATH } from '@test/utils/test-utils';

declare global {
  var __test_server__: Server | undefined;
}

interface TextContent {
  type: "text";
  text: string;
}

interface ToolResponse {
  content: TextContent[];
}

const toolResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
}) as z.ZodType<ToolResponse>;

describe('MCP Server Integration', () => {
  let server: Server;
  let client: Client;

  beforeEach(async () => {
    console.log(`[${new Date().toISOString()}] === Setting up test environment ===\n`);
    // Get the server instance from the setup
    const globalServer = global.__test_server__;
    if (!globalServer) {
      throw new Error('Server not initialized in setup');
    }
    server = globalServer;
    logInfo('Protocol', 'Test server initialized');
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] === Test completed ===\n`);
  });

  const getServerUrl = () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_SERVER_ADDRESS);
    }
    return `http://localhost:${address.port}`;
  };

  const createClient = async () => {
    const serverUrl = getServerUrl();
    const transport = new SSEClientTransport(
      new URL(`${serverUrl}/sse`)
    );
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: true,
          prompts: false,
          resources: false,
          logging: false,
          roots: { listChanged: false }
        }
      }
    );

    // Wait for connection to be established
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, TIMEOUTS.CONNECTION);

      transport.onclose = () => {
        clearTimeout(timeout);
        reject(new Error('Connection closed'));
      };

      transport.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      transport.onmessage = () => {
        clearTimeout(timeout);
        resolve();
      };

      client.connect(transport).catch(reject);
    });

    return client;
  };

  describe('Connection Management', () => {
    it('should connect to the SSE server', async () => {
      const client = await createClient();
      expect(client).toBeDefined();
    });

    it('should handle reconnection attempts', async () => {
      // First connection
      const client1 = await createClient();
      expect(client1).toBeDefined();
      await client1.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second connection
      const client2 = await createClient();
      expect(client2).toBeDefined();
      await client2.close();
    });
  });

  describe('Tool Discovery and Documentation', () => {
    it('should discover and fetch tool documentation', async () => {
      const client = await createClient();
      
      // List available tools
      const tools = await client.request(
        {
          method: 'list-available-tools',
          params: {
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      );
      const toolsList = JSON.parse(tools.content[0].text) as ToolInfo[];
      expect(toolsList.length).toBeGreaterThan(0);
      expect(toolsList.some(t => t.name === 'list-available-tools')).toBe(true);
      expect(toolsList.some(t => t.name === 'get-tool-info')).toBe(true);

      // Get tool info
      const toolInfo = await client.request(
        {
          method: 'get-tool-info',
          params: {
            toolName: 'list-available-tools',
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      );
      const toolData = JSON.parse(toolInfo.content[0].text) as ToolInfo;
      expect(toolData.name).toBe('list-available-tools');
      expect(toolData.type).toBeDefined();
    });

    it('should cache documentation results', async () => {
      const client = await createClient();
      
      // First request
      const start1 = Date.now();
      const info1 = await client.request(
        {
          method: 'get-tool-info',
          params: {
            toolName: 'list-available-tools',
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      );
      const time1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      const info2 = await client.request(
        {
          method: 'get-tool-info',
          params: {
            toolName: 'list-available-tools',
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      );
      const time2 = Date.now() - start2;

      expect(info1.content).toEqual(info2.content);
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool gracefully', async () => {
      const client = await createClient();
      
      await expect(client.request(
        {
          method: 'get-tool-info',
          params: {
            toolName: 'nonexistenttool',
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      )).rejects.toThrow('Tool not found');
    });

    it('should handle invalid message format', async () => {
      const serverUrl = getServerUrl();
      
      const response = await fetch(`${serverUrl}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400); // Changed from 500 to 400 for invalid format
    });
  });

  describe('Security', () => {
    it('should reject invalid origin', async () => {
      const serverUrl = getServerUrl();
      
      const response = await fetch(`${serverUrl}/sse`, {
        headers: { 'Origin': 'invalid-origin' }
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });

  describe('SSE Connection Management', () => {
    it('should maintain initialization state after expected disconnects', async () => {
      // First connection
      const client1 = await createClient();
      expect(client1).toBeDefined();
      await client1.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second connection
      const client2 = await createClient();
      expect(client2).toBeDefined();
      
      // Verify we can still make requests
      const tools = await client2.request(
        {
          method: 'list-available-tools',
          params: {
            projectPath: TEST_MONOREPO_PATH
          }
        },
        toolResponseSchema
      );
      const toolsList = JSON.parse(tools.content[0].text) as ToolInfo[];
      expect(toolsList.length).toBeGreaterThan(0);
    });
  });
}); 
