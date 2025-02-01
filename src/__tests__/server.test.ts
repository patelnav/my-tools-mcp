import { describe, it, expect } from 'vitest';
import WebSocket from 'ws';
import { DocumentationResponse } from '@/types';

describe('MCP Server Integration', () => {
  it('should connect to the WebSocket server', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        resolve();
      });

      ws.on('error', reject);
    });
  });

  it('should fetch git documentation', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'SELECT_TOOL',
          payload: {
            name: 'git',
            projectPath: process.cwd()
          }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'DOCUMENTATION_UPDATED') {
            const doc = message.payload as DocumentationResponse;
            expect(doc.success).toBe(true);
            expect(doc.data).toBeDefined();
            expect(doc.data?.name).toBe('git');
            expect(doc.data?.version).toBeDefined();
            expect(doc.data?.helpText).toBeDefined();
            ws.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
    });
  });

  it('should handle invalid tool gracefully', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'SELECT_TOOL',
          payload: {
            name: 'nonexistenttool',
            projectPath: process.cwd()
          }
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'DOCUMENTATION_UPDATED') {
            const doc = message.payload as DocumentationResponse;
            expect(doc.success).toBe(false);
            expect(doc.error).toBeDefined();
            ws.close();
            resolve();
          } else if (message.type === 'ERROR') {
            expect(message.payload).toBeDefined();
            ws.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
    });
  });

  it('should handle invalid message format', () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.on('open', () => {
        ws.send('invalid json');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'ERROR') {
            expect(message.payload).toBe('Invalid message format');
            ws.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
    });
  });
}); 