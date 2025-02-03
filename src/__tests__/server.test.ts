import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { DocumentationResponse } from '@/types';
import { TEST_CONFIG } from './test-config';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';
import { ToolInfo } from '@server/controllers/docs/path-scanner';

describe('MCP Server Integration', () => {
  let server: Server;

  beforeEach(async () => {
    // Get the server instance from the setup
    const globalServer = global.__test_server__;
    if (!globalServer) {
      throw new Error('Server not initialized in setup');
    }
    server = globalServer;
  });

  const wsOptions = {
    headers: {
      'Origin': TEST_CONFIG.websocket.origin
    }
  };

  const getWsUrl = () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Invalid server address');
    }
    return `ws://localhost:${address.port}`;
  };

  // Helper function to create a WebSocket connection with timeout
  const createWebSocket = (timeout = 5000) => {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(getWsUrl(), wsOptions);
      
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket connection timed out after ${timeout}ms`));
      }, timeout);

      ws.on('open', () => {
        clearTimeout(timeoutId);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  };

  // Helper function to wait for a specific message type
  const waitForMessage = (ws: WebSocket, type: string) => {
    return new Promise<any>((resolve, reject) => {
      const messageHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === type) {
            ws.removeListener('message', messageHandler);
            resolve(message);
          }
        } catch (error) {
          ws.removeListener('message', messageHandler);
          reject(error);
        }
      };

      const errorHandler = (error: Error) => {
        ws.removeListener('message', messageHandler);
        ws.removeListener('error', errorHandler);
        reject(error);
      };

      const closeHandler = () => {
        ws.removeListener('message', messageHandler);
        ws.removeListener('error', errorHandler);
        ws.removeListener('close', closeHandler);
        reject(new Error('WebSocket closed while waiting for message'));
      };

      ws.on('message', messageHandler);
      ws.on('error', errorHandler);
      ws.on('close', closeHandler);
    });
  };

  // Helper function to create a test with WebSocket connection
  const createWebSocketTest = (testFn: (ws: WebSocket) => Promise<void> | void, timeout = 5000) => {
    return new Promise<void>(async (resolve, reject) => {
      let ws: WebSocket | undefined;
      try {
        ws = await createWebSocket(timeout);
        await testFn(ws);
        ws.close();
        resolve();
      } catch (error) {
        if (ws) ws.close();
        reject(error);
      }
    });
  };

  // Helper function to send a tool selection message
  const selectTool = (ws: WebSocket, toolName: string) => {
    ws.send(JSON.stringify({
      type: 'SELECT_TOOL',
      payload: {
        name: toolName,
        projectPath: process.cwd()
      }
    }));
  };

  // Helper function to expect a message of a certain type
  const expectMessage = async (ws: WebSocket, type: string, assertFn?: (message: any) => void) => {
    const message = await Promise.race([
      waitForMessage(ws, type),
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, 5000);
        ws.once('close', () => {
          clearTimeout(timeoutId);
          reject(new Error('WebSocket closed while waiting for message'));
        });
      })
    ]);

    if (assertFn) {
      assertFn(message);
    }
    return message;
  };

  // Helper function to create multiple connections
  const createMultipleConnections = (count: number) => 
    Promise.all(Array(count).fill(null).map(() => createWebSocket()));

  it('should connect to the WebSocket server', () =>
    createWebSocketTest(async (ws) => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
    })
  );

  it('should discover and fetch git documentation', () =>
    createWebSocketTest(async (ws) => {
      // First discover tools
      ws.send(JSON.stringify({
        type: 'DISCOVER_TOOLS',
        payload: { projectPath: process.cwd() }
      }));

      // Wait for tool discovery
      await expectMessage(ws, 'TOOLS_DISCOVERED', (message) => {
        const tools = message.payload as ToolInfo[];
        expect(tools).toContainEqual(expect.objectContaining({
          name: 'git',
          type: 'workspace-bin'
        }));
      });

      // Then select git for documentation
      selectTool(ws, 'git');
      await expectMessage(ws, 'DOCUMENTATION_UPDATED', (message) => {
        const doc = message.payload as DocumentationResponse;
        expect(doc.success).toBe(true);
        expect(doc.data).toBeDefined();
        expect(doc.data?.name).toBe('git');
        expect(doc.data?.version).toBeDefined();
        expect(doc.data?.helpText).toBeDefined();
      });
    })
  );

  it('should handle invalid tool gracefully', () =>
    createWebSocketTest(async (ws) => {
      // First try to discover tools
      ws.send(JSON.stringify({
        type: 'DISCOVER_TOOLS',
        payload: { projectPath: process.cwd() }
      }));

      // Wait for tool discovery
      await expectMessage(ws, 'TOOLS_DISCOVERED');

      // Then try an invalid tool
      selectTool(ws, 'nonexistenttool');
      await expectMessage(ws, 'DOCUMENTATION_UPDATED', (message) => {
        const doc = message.payload as DocumentationResponse;
        expect(doc.success).toBe(false);
        expect(doc.error).toBeDefined();
        expect(doc.error).toContain('not found');
      });
    })
  );

  it('should handle invalid message format', () =>
    createWebSocketTest(async (ws) => {
      ws.send('invalid json');
      await expectMessage(ws, 'ERROR', (message) => {
        expect(message.payload).toBe('Invalid message format');
      });
    })
  );

  it('should enforce rate limiting', async () => {
    const ws = await createWebSocket();
    const maxRequests = 61; // One over the limit
    const message = {
      type: 'SELECT_TOOL',
      payload: { name: 'git', projectPath: process.cwd() }
    };
    
    // Track responses
    const messages: string[] = [];
    const messagePromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error('Rate limit test timed out'));
      }, 5000);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push(message.type);
          
          // Check if we've hit the rate limit
          if (message.type === 'ERROR' && message.payload === 'Rate limit exceeded') {
            clearTimeout(timeoutId);
            expect(messages.filter(m => m === 'DOCUMENTATION_UPDATED').length).toBeLessThan(maxRequests);
            ws.close();
            resolve();
          }
          
          // Or if we've received all successful responses (test failed)
          if (messages.filter(m => m === 'DOCUMENTATION_UPDATED').length >= maxRequests) {
            clearTimeout(timeoutId);
            ws.close();
            reject(new Error('Rate limit was not enforced'));
          }
        } catch (error) {
          clearTimeout(timeoutId);
          ws.close();
          reject(error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    // Send requests one at a time to not overwhelm the connection
    for (let i = 0; i < maxRequests; i++) {
      ws.send(JSON.stringify(message));
      // Small delay between sends to ensure order
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await messagePromise;
  });

  it('should reject invalid origin', async () => {
    const invalidWs = new WebSocket(getWsUrl(), {
      headers: { 'Origin': 'invalid-origin' }
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          invalidWs.close();
          reject(new Error('Test timed out'));
        }, 5000);

        invalidWs.on('error', (error) => {
          clearTimeout(timeoutId);
          expect(error.message).toContain('401');
          resolve();
        });

        invalidWs.on('open', () => {
          clearTimeout(timeoutId);
          invalidWs.close();
          reject(new Error('Connection should not be established'));
        });
      });
    } finally {
      invalidWs.close();
    }
  });

  it('should handle multiple concurrent connections', async () => {
    const connections = await createMultipleConnections(3);
    expect(connections.every(ws => ws.readyState === WebSocket.OPEN)).toBe(true);
    connections.forEach(ws => ws.close());
  });

  it('should send workspace path on connection', async () => {
    // Create a promise that will resolve when we receive the workspace path
    const workspacePathPromise = new Promise<any>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for workspace path message'));
      }, 5000);

      // Create WebSocket and set up handlers
      const ws = new WebSocket(getWsUrl(), wsOptions);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'WORKSPACE_PATH') {
            clearTimeout(timeoutId);
            ws.close();
            resolve(message);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      ws.on('close', () => {
        clearTimeout(timeoutId);
      });
    });

    // Wait for the workspace path message
    const message = await workspacePathPromise;
    expect(message).toBeDefined();
    expect(message.type).toBe('WORKSPACE_PATH');
    expect(message.path).toBe(process.cwd());
  });

  it('should handle reconnection attempts', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(getWsUrl(), wsOptions);
      let firstPathReceived = false;

      ws1.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'WORKSPACE_PATH') {
            expect(message.path).toBe(process.cwd());
            firstPathReceived = true;
            ws1.close();

            // Wait a bit before reconnecting
            await new Promise(resolve => setTimeout(resolve, 100));

            // Second connection
            const ws2 = new WebSocket(getWsUrl(), wsOptions);
            
            ws2.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'WORKSPACE_PATH') {
                  expect(message.path).toBe(process.cwd());
                  ws2.close();
                  resolve();
                }
              } catch (error) {
                ws2.close();
                reject(error);
              }
            });

            ws2.on('error', (error) => {
              reject(error);
            });
          }
        } catch (error) {
          ws1.close();
          reject(error);
        }
      });

      ws1.on('error', (error) => {
        reject(error);
      });

      // Set a timeout for the entire test
      const timeoutId = setTimeout(() => {
        if (!firstPathReceived) {
          ws1.close();
        }
        reject(new Error('Test timed out'));
      }, 5000);
    });
  });

  it('should validate workspace path exists', async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(getWsUrl(), wsOptions);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'WORKSPACE_PATH') {
            expect(message.path).toBe(process.cwd());
            ws.close();
            resolve();
          }
        } catch (error) {
          ws.close();
          reject(error);
        }
      });

      ws.on('error', (error) => {
        reject(error);
      });

      // Set a timeout for the test
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error('Test timed out waiting for workspace path'));
      }, 5000);

      ws.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  });

  it('should cache documentation results', () =>
    createWebSocketTest(async (ws) => {
      // First discover tools
      ws.send(JSON.stringify({
        type: 'DISCOVER_TOOLS',
        payload: { projectPath: process.cwd() }
      }));

      // Wait for tool discovery
      await expectMessage(ws, 'TOOLS_DISCOVERED');

      // Request git docs twice
      selectTool(ws, 'git');
      const firstResponse = await expectMessage(ws, 'DOCUMENTATION_UPDATED');
      
      selectTool(ws, 'git');
      const secondResponse = await expectMessage(ws, 'DOCUMENTATION_UPDATED');

      // Should get same lastUpdated timestamp (from cache)
      expect(firstResponse.payload.data?.lastUpdated).toBe(secondResponse.payload.data?.lastUpdated);
    })
  );
}); 
