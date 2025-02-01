import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { AddressInfo } from 'net';
import { DocumentationResponse, ToolSelection } from '@/types/types';
import { fetchToolDocumentation } from './controllers/docs';
import { getServerConfig, ServerConfig, isValidVSCodeWebviewOrigin } from './config';
import fs from 'fs';
import path from 'path';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

interface VerifyClientInfo {
  origin: string;
  secure: boolean;
  req: http.IncomingMessage;
}

// Debug logging function - this will be replaced by the extension's logger
let logCallback: (message: string, type?: 'info' | 'error' | 'warn') => void = 
  (message, type = 'info') => console.log(`[MCP Server] ${message}`);

export function setLogCallback(callback: typeof logCallback) {
  logCallback = callback;
}

function validateWorkspacePath(workspacePath: string): string {
  // If path doesn't exist or isn't a directory, fall back to current working directory
  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    logCallback(`Invalid workspace path: ${workspacePath}, falling back to cwd`, 'warn');
    return process.cwd();
  }
  // Return absolute path to avoid any relative path issues
  return path.resolve(workspacePath);
}

export async function startMCPServer(workspacePath: string, isTest = false) {
  const config = await getServerConfig(isTest);
  const validWorkspacePath = validateWorkspacePath(workspacePath);
  logCallback(`Starting server with config: ${JSON.stringify(config)}`);
  
  const app = express();
  
  // Security: Restrict CORS
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.allowedOrigins.has(origin) || isValidVSCodeWebviewOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST']
  }));
  
  app.use(express.json());

  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    // Security: Verify client connection
    verifyClient: ({ origin }: VerifyClientInfo) => {
      const allowed = config.allowedOrigins.has(origin) || isValidVSCodeWebviewOrigin(origin);
      if (!allowed) {
        logCallback(`Rejected connection from unauthorized origin: ${origin}`, 'warn');
      } else {
        logCallback(`Accepted connection from origin: ${origin}`);
      }
      return allowed;
    }
  });

  // Store rate limit information for each client
  const clientLimits = new Map<WebSocket, RateLimitInfo>();

  // Handle server errors
  wss.on('error', (error) => {
    logCallback(`WebSocket server error: ${error.message}`, 'error');
  });

  // WebSocket connection handling
  wss.on('connection', (ws, request) => {
    const clientIp = request.socket.remoteAddress;
    logCallback(`Client connected from ${clientIp}`, 'info');

    // Send workspace path immediately on connection
    try {
      const workspaceMessage = JSON.stringify({
        type: 'WORKSPACE_PATH',
        path: validWorkspacePath
      });
      logCallback(`Sending workspace path message: ${workspaceMessage}`, 'info');
      ws.send(workspaceMessage);
      logCallback('Workspace path message sent successfully', 'info');
    } catch (error) {
      logCallback(`Failed to send workspace path: ${error}`, 'error');
    }

    // Security: Initialize rate limiting for this client
    clientLimits.set(ws, {
      count: 0,
      resetTime: Date.now() + config.rateLimit.windowMs
    });

    // Handle client errors
    ws.on('error', (error) => {
      logCallback(`WebSocket client error: ${error.message}`, 'error');
      ws.close();
    });

    ws.on('message', async (message: Buffer) => {
      // Security: Check rate limit
      const limitInfo = clientLimits.get(ws);
      if (!limitInfo) {
        logCallback(`No rate limit info for client ${clientIp}`, 'warn');
        ws.close();
        return;
      }

      if (Date.now() > limitInfo.resetTime) {
        limitInfo.count = 0;
        limitInfo.resetTime = Date.now() + config.rateLimit.windowMs;
      }

      if (++limitInfo.count > config.rateLimit.maxRequestsPerMinute) {
        logCallback(`Rate limit exceeded for client ${clientIp}`, 'warn');
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Rate limit exceeded'
        }));
        return;
      }

      try {
        const data = JSON.parse(message.toString());
        logCallback(`Received message from ${clientIp}: ${JSON.stringify(data)}`);

        if (data.type === 'SELECT_TOOL') {
          const toolSelection: ToolSelection = data.payload;
          try {
            const documentation = await fetchToolDocumentation(toolSelection);
            ws.send(JSON.stringify({
              type: 'DOCUMENTATION_UPDATED',
              payload: documentation
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logCallback(`Failed to fetch documentation: ${errorMessage}`, 'error');
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: 'Failed to fetch documentation'
            }));
          }
        } else {
          logCallback(`Invalid message type from ${clientIp}: ${data.type}`, 'warn');
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: 'Invalid message type'
          }));
        }
      } catch (error) {
        logCallback('Error parsing message', 'error');
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      // Security: Clean up rate limit info when client disconnects
      clientLimits.delete(ws);
      logCallback(`Client ${clientIp} disconnected`);
    });
  });

  // Start the server
  server.listen(config.port, config.host, () => {
    logCallback(`Server listening at http://${config.host}:${config.port}`);
  });

  return server;
} 