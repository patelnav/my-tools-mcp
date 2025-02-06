import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import type { DocumentationResponse } from '@/types/types';
import { TEST_CONFIG } from '../test-config';
import type { Server } from 'http';
import type { ToolInfo } from '@server/controllers/docs/path-scanner';
import type { WsTestOptions } from '@test/utils/test-utils';
import { createTestWebSocket, waitForWsMessage, getTestWorkspacePath, TEST_MONOREPO_PATH } from '@test/utils/test-utils';
import { logHeader, logStep, logSuccess } from '@utils/logging';
import { WS_MESSAGE_TYPES, ERROR_MESSAGES, TIMEOUTS } from '@/constants';

declare global {
  var __test_server__: Server | undefined;
}

describe('MCP Server Integration', () => {
  let server: Server;

  beforeEach(async () => {
    console.log(`[${new Date().toISOString()}] === Setting up test environment ===\n`);
    // Get the server instance from the setup
    const globalServer = global.__test_server__;
    if (!globalServer) {
      throw new Error('Server not initialized in setup');
    }
    server = globalServer;
    logSuccess('Test server initialized');
  });

  afterEach(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] === Test completed ===\n`);
  });

  const wsOptions: WsTestOptions = {
    origin: TEST_CONFIG.websocket.origin,
    timeout: TIMEOUTS.STANDARD
  };

  const getWsUrl = () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error(ERROR_MESSAGES.INVALID_SERVER_ADDRESS);
    }
    return `ws://localhost:${address.port}`;
  };

  // Helper function to send a tool selection message
  const selectTool = (ws: WebSocket, toolName: string) => {
    ws.send(JSON.stringify({
      type: WS_MESSAGE_TYPES.SELECT_TOOL,
      payload: {
        name: toolName,
        projectPath: TEST_MONOREPO_PATH
      }
    }));
  };

  describe('Connection Management', () => {
    it('should connect to the WebSocket server', async () => {
      console.log('\n=== Setting up test environment ===\n');
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      const actualPort = address.port;
      console.log(`  ✓ Test server initialized on port ${actualPort}\n`);

      console.log('=== Testing WebSocket connection ===\n');
      console.log('  → Attempting to connect to server');

      const startTime = Date.now();
      let messageReceived = false;

      // Create a promise that will resolve when we receive the WORKSPACE_PATH message
      const messagePromise = new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${actualPort}`, {
          origin: 'vscode-test://mcp-tools'
        });

        ws.on('error', (error) => {
          console.error(`  ✗ WebSocket connection error: ${error.message}`);
          reject(error);
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`  → Received message: ${JSON.stringify(message)}`);
            if (message.type === 'WORKSPACE_PATH') {
              console.log(`  ✓ Received WORKSPACE_PATH message after ${Date.now() - startTime}ms`);
              messageReceived = true;
              ws.close();
              resolve();
            }
          } catch (error) {
            console.error(`  ✗ Error parsing message: ${error}`);
            reject(error);
          }
        });

        ws.on('open', () => {
          console.log(`  ✓ Successfully connected to WebSocket server after ${Date.now() - startTime}ms`);
        });

        ws.on('close', () => {
          console.log('  → WebSocket connection closed');
        });
      });

      try {
        // Wait for the message with a timeout
        await messagePromise;
        expect(messageReceived).toBe(true);
      } catch (error) {
        throw error;
      }
    });

    it('should handle reconnection attempts', async () => {
      // Set proper test timeout according to rules
      // Note: Vitest uses testTimeout in config, not per-test timeouts
      
      console.log('\n=== Setting up test environment ===\n');
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error(ERROR_MESSAGES.INVALID_SERVER_ADDRESS);
      }
      const actualPort = address.port;
      console.log(`  ✓ Test server initialized on port ${actualPort}\n`);

      console.log('=== Testing reconnection handling ===\n');
      console.log('  → Setting up first connection');

      // First connection with proper timeout
      const firstConnectionPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('First connection timed out waiting for WORKSPACE_PATH'));
        }, 200); // 200ms is sufficient for initial connection

        const ws1 = new WebSocket(`ws://localhost:${actualPort}`, {
          origin: 'vscode-test://mcp-tools'
        });

        ws1.on('error', (error) => {
          clearTimeout(timeoutId);
          console.error(`  ✗ First connection error: ${error.message}`);
          reject(error);
        });

        ws1.on('open', () => {
          console.log('  ✓ First connection established');
        });

        ws1.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`  → First connection received message: ${JSON.stringify(message)}`);
            if (message.type === 'WORKSPACE_PATH') {
              console.log('  ✓ First connection received WORKSPACE_PATH');
              clearTimeout(timeoutId);
              resolve();
              ws1.close();
            }
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        ws1.on('close', () => {
          console.log('  ✓ First connection closed');
        });
      });

      await firstConnectionPromise;

      // Wait for server to clean up - 20ms is sufficient for cleanup
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify server has 0 connections
      const connectionCount = await new Promise<number>((resolve, reject) => {
        server.getConnections((err, count) => {
          if (err) reject(err);
          console.log(`  → Current server connections: ${count}`);
          resolve(count);
        });
      });
      expect(connectionCount).toBe(0);

      // Second connection with proper timeout
      const secondConnectionPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Second connection timed out waiting for WORKSPACE_PATH'));
        }, 200); // 200ms is sufficient for reconnection

        const ws2 = new WebSocket(`ws://localhost:${actualPort}`, {
          origin: 'vscode-test://mcp-tools'
        });

        ws2.on('error', (error) => {
          clearTimeout(timeoutId);
          console.error(`  ✗ Second connection error: ${error.message}`);
          reject(error);
        });

        ws2.on('open', () => {
          console.log('  ✓ Second connection established');
        });

        ws2.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`  → Second connection received message: ${JSON.stringify(message)}`);
            if (message.type === 'WORKSPACE_PATH') {
              console.log('  ✓ Second connection received WORKSPACE_PATH');
              clearTimeout(timeoutId);
              resolve();
              ws2.close();
            }
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        ws2.on('close', () => {
          console.log('  ✓ Second connection closed');
        });
      });

      await secondConnectionPromise;
    });
  });

  describe('Tool Discovery and Documentation', () => {
    it('should discover and fetch git documentation', async () => {
      logHeader('Testing tool discovery and documentation fetching');
      const ws = await createTestWebSocket(getWsUrl(), wsOptions);
      
      try {
        logStep('Discovering available tools');
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.DISCOVER_TOOLS,
          payload: { projectPath: TEST_MONOREPO_PATH }
        }));

        const discoveredMessage = await waitForWsMessage(ws, WS_MESSAGE_TYPES.TOOLS_DISCOVERED, TIMEOUTS.STANDARD);
        const tools = discoveredMessage.payload as ToolInfo[];
        const gitTool = tools.find(t => t.name === 'git' && t.type === 'workspace-bin');
        expect(gitTool).toBeDefined();
        logSuccess(`Found git tool: ${JSON.stringify(gitTool)}`);

        logStep('Fetching git documentation');
        selectTool(ws, 'git');
        const docMessage = await waitForWsMessage(ws, WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED, TIMEOUTS.DOC_FETCH);
        const doc = docMessage.payload as DocumentationResponse;
        
        if (!doc.success) {
          console.error('Documentation fetch failed:', doc.error);
          throw new Error(ERROR_MESSAGES.DOCUMENTATION_FETCH_FAILED);
        }
        
        expect(doc.success).toBe(true);
        expect(doc.data).toBeDefined();
        expect(doc.data?.name).toBe('git');
        expect(doc.data?.version).toBeDefined();
        expect(doc.data?.helpText).toBeDefined();
        logSuccess('Git documentation fetched successfully');
      } finally {
        ws.close();
      }
    });

    it('should cache documentation results', async () => {
      logHeader('Testing documentation caching');
      const ws = await createTestWebSocket(getWsUrl(), wsOptions);
      
      try {
        logStep('Discovering tools');
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.DISCOVER_TOOLS,
          payload: { projectPath: getTestWorkspacePath() }
        }));
        await waitForWsMessage(ws, WS_MESSAGE_TYPES.TOOLS_DISCOVERED, TIMEOUTS.STANDARD);
        
        logStep('Requesting git documentation twice');
        selectTool(ws, 'git');
        const firstResponse = await waitForWsMessage(ws, WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED, TIMEOUTS.STANDARD);
        
        selectTool(ws, 'git');
        const secondResponse = await waitForWsMessage(ws, WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED, TIMEOUTS.STANDARD);

        expect(firstResponse.payload.data?.lastUpdated).toBe(secondResponse.payload.data?.lastUpdated);
        logSuccess('Documentation caching verified');
      } finally {
        ws.close();
      }
    });

    it('should provide properly formatted documentation', async () => {
      logHeader('Testing documentation format and content');
      const ws = await createTestWebSocket(getWsUrl(), wsOptions);
      
      try {
        logStep('Discovering tools');
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.DISCOVER_TOOLS,
          payload: { projectPath: getTestWorkspacePath() }
        }));
        await waitForWsMessage(ws, WS_MESSAGE_TYPES.TOOLS_DISCOVERED, TIMEOUTS.STANDARD);
        
        logStep('Requesting git documentation');
        selectTool(ws, 'git');
        const docMessage = await waitForWsMessage(ws, WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED, TIMEOUTS.DOC_FETCH);
        const doc = docMessage.payload as DocumentationResponse;
        
        // Verify documentation structure
        expect(doc.success).toBe(true);
        expect(doc.data).toBeDefined();
        expect(doc.data?.name).toBe('git');
        expect(doc.data?.version).toMatch(/^git version \d+\.\d+\.\d+/); // Match actual git version format
        expect(doc.data?.helpText).toBeDefined();
        expect(doc.data?.lastUpdated).toBeDefined();
        
        // Verify documentation content
        expect(doc.data?.helpText).toContain('git - the stupid content tracker');
        expect(doc.data?.helpText).toContain('usage: git');
        expect(doc.data?.helpText.length).toBeGreaterThan(50);
        
        logSuccess('Documentation format and content verified');
      } finally {
        ws.close();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool gracefully', async () => {
      logHeader('Testing invalid tool handling');
      const ws = await createTestWebSocket(getWsUrl(), wsOptions);
      
      try {
        logStep('Discovering tools');
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.DISCOVER_TOOLS,
          payload: { projectPath: getTestWorkspacePath() }
        }));
        await waitForWsMessage(ws, WS_MESSAGE_TYPES.TOOLS_DISCOVERED, TIMEOUTS.STANDARD);

        logStep('Requesting invalid tool documentation');
        selectTool(ws, 'nonexistenttool');
        const message = await waitForWsMessage(ws, WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED, TIMEOUTS.STANDARD);
        const doc = message.payload as DocumentationResponse;
        expect(doc.success).toBe(false);
        expect(doc.error).toBeDefined();
        expect(doc.error).toBe(ERROR_MESSAGES.TOOL_NOT_FOUND('nonexistenttool'));
        logSuccess('Invalid tool handled correctly');
      } finally {
        ws.close();
      }
    });

    it('should handle invalid message format', async () => {
      logHeader('Testing invalid message handling');
      const ws = await createTestWebSocket(getWsUrl(), wsOptions);
      
      try {
        logStep('Sending invalid JSON message');
        ws.send('invalid json');
        const message = await waitForWsMessage(ws, WS_MESSAGE_TYPES.ERROR, TIMEOUTS.STANDARD);
        expect(message.payload).toBe(ERROR_MESSAGES.INVALID_MESSAGE_FORMAT);
        logSuccess('Invalid message handled correctly');
      } finally {
        ws.close();
      }
    });
  });

  describe('Security', () => {
    it('should reject invalid origin', async () => {
      logHeader('Testing origin validation');
      logStep('Attempting connection with invalid origin');
      try {
        await createTestWebSocket(getWsUrl(), { origin: 'invalid-origin', timeout: TIMEOUTS.STANDARD });
        throw new Error('Connection should not be established');
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toContain('401');
          logSuccess('Invalid origin rejected successfully');
        } else {
          throw error;
        }
      }
    });
    // Rate limiting test removed temporarily
  });
}); 
