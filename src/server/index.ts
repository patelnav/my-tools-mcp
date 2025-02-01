import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import http from 'http';
import { AddressInfo } from 'net';
import { ServerConfig, DocumentationResponse, ToolSelection } from '@/types/types';
import { fetchToolDocumentation } from './controllers/docs';

// Security: Allowed origins and rate limiting configuration
const ALLOWED_ORIGINS = new Set(['vscode-webview://']);
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

interface VerifyClientInfo {
  origin: string;
  secure: boolean;
  req: http.IncomingMessage;
}

const config: ServerConfig = {
  port: 8080,
  host: 'localhost'
};

export function startMCPServer() {
  const app = express();
  
  // Security: Restrict CORS
  app.use(cors({
    origin: Array.from(ALLOWED_ORIGINS),
    methods: ['GET', 'POST']
  }));
  
  app.use(express.json());

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server
  const wss = new WebSocket.Server({ 
    server,
    // Security: Verify client connection
    verifyClient: ({ origin }: VerifyClientInfo) => ALLOWED_ORIGINS.has(origin)
  });

  // Store rate limit information for each client
  const clientLimits = new Map<WebSocket, RateLimitInfo>();

  // WebSocket connection handling
  wss.on('connection', (ws, request) => {
    console.log('Client connected to MCP server');

    // Security: Initialize rate limiting for this client
    clientLimits.set(ws, {
      count: 0,
      resetTime: Date.now() + RATE_LIMIT_WINDOW
    });

    ws.on('message', async (message: Buffer) => {
      // Security: Check rate limit
      const limitInfo = clientLimits.get(ws);
      if (!limitInfo) {
        ws.close();
        return;
      }

      if (Date.now() > limitInfo.resetTime) {
        limitInfo.count = 0;
        limitInfo.resetTime = Date.now() + RATE_LIMIT_WINDOW;
      }

      if (++limitInfo.count > MAX_REQUESTS_PER_MINUTE) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Rate limit exceeded'
        }));
        return;
      }

      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);

        if (data.type === 'SELECT_TOOL') {
          const toolSelection: ToolSelection = data.payload;
          try {
            const documentation = await fetchToolDocumentation(toolSelection);
            ws.send(JSON.stringify({
              type: 'DOCUMENTATION_UPDATED',
              payload: documentation
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: 'Failed to fetch documentation'
            }));
          }
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: 'Invalid message type'
          }));
        }
      } catch (error) {
        console.error('Error handling message');
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      // Security: Clean up rate limit info when client disconnects
      clientLimits.delete(ws);
      console.log('Client disconnected from MCP server');
    });
  });

  // Start the server
  server.listen(config.port, config.host, () => {
    console.log(`MCP server running at http://${config.host}:${config.port}`);
  });

  return server;
} 