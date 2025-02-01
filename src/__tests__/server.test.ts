import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { DocumentationResponse } from '@/types';
import { TEST_CONFIG } from './test-config';
import { startMCPServer } from '@server/index';
import type { Server } from 'http';
import path from 'path';
import fs from 'fs';

describe('MCP Server Integration', () => {
  let server: Server;

  beforeAll(async () => {
    // Get the server instance from the setup
    const globalServer = global.server;
    if (!globalServer) {
      throw new Error('Server not initialized in setup');
    }
    server = globalServer;
  });

  afterAll(() => {
    // Don't close the server here, it will be closed in teardown
    return Promise.resolve();
  });

  const wsOptions = {
    headers: {
      'Origin': TEST_CONFIG.websocket.origin
    }
  };

  const getWsUrl = () => `ws://${TEST_CONFIG.server.host}:${TEST_CONFIG.server.port}`;

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
          console.log(`Received message: ${JSON.stringify(message)}`);
          if (message.type === type) {
            console.log(`Found matching message type: ${type}`);
            ws.removeListener('message', messageHandler);
            resolve(message);
          } else {
            console.log(`Message type ${message.type} did not match expected type ${type}`);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          ws.removeListener('message', messageHandler);
          reject(error);
        }
      };

      const errorHandler = (error: Error) => {
        console.error('WebSocket error:', error);
        ws.removeListener('message', messageHandler);
        ws.removeListener('error', errorHandler);
        reject(error);
      };

      const closeHandler = () => {
        console.log('WebSocket closed while waiting for message');
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
    console.log(`Waiting for message type: ${type}`);
    const message = await Promise.race([
      waitForMessage(ws, type),
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          console.log(`Timeout reached while waiting for message type: ${type}`);
          reject(new Error(`Timeout waiting for message type: ${type}`));
        }, 5000);
        ws.once('close', () => {
          console.log('WebSocket closed during expectMessage');
          clearTimeout(timeoutId);
          reject(new Error('WebSocket closed while waiting for message'));
        });
      })
    ]);

    console.log(`Successfully received message of type ${type}`);
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

  it('should fetch git documentation', () =>
    createWebSocketTest(async (ws) => {
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
      selectTool(ws, 'nonexistenttool');
      await expectMessage(ws, 'DOCUMENTATION_UPDATED', (message) => {
        const doc = message.payload as DocumentationResponse;
        expect(doc.success).toBe(false);
        expect(doc.error).toBeDefined();
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
    
    // Send all requests at once
    await Promise.all(
      Array(maxRequests).fill(null).map(() => 
        ws.send(JSON.stringify(message))
      )
    );

    return new Promise<void>((resolve) => {
      const messages: string[] = [];
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messages.push(message.type);
        
        if (message.type === 'ERROR' && message.payload === 'Rate limit exceeded') {
          expect(messages.filter(m => m === 'DOCUMENTATION_UPDATED').length).toBeLessThan(maxRequests);
          ws.close();
          resolve();
        }
      });
    });
  });

  it('should reject invalid origin', () => {
    const invalidWs = new WebSocket(getWsUrl(), {
      headers: { 'Origin': 'invalid-origin' }
    });

    return new Promise<void>((resolve, reject) => {
      invalidWs.on('error', (error) => {
        expect(error.message).toContain('401');
        resolve();
      });

      invalidWs.on('open', () => {
        reject(new Error('Connection should not be established'));
      });
    });
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
          console.log(`Received message: ${JSON.stringify(message)}`);
          if (message.type === 'WORKSPACE_PATH') {
            clearTimeout(timeoutId);
            ws.close();
            resolve(message);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeoutId);
        reject(error);
      });

      ws.on('close', () => {
        console.log('WebSocket closed');
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
    // First connection
    return new Promise<void>((resolve, reject) => {
      const ws1 = new WebSocket(getWsUrl(), wsOptions);
      let firstPathReceived = false;

      ws1.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('First connection received:', message);
          
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
                console.log('Second connection received:', message);
                
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
              console.error('Second connection error:', error);
              reject(error);
            });
          }
        } catch (error) {
          ws1.close();
          reject(error);
        }
      });

      ws1.on('error', (error) => {
        console.error('First connection error:', error);
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
          console.log('Validation test received:', message);
          
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
        console.error('Validation test error:', error);
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
}); 
