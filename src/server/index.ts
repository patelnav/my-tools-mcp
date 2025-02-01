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
  (message, type = 'info') => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[MCP Server] ${message}`);
    }
  };

export function setLogCallback(callback: typeof logCallback) {
  logCallback = callback;
}

function validateWorkspacePath(workspacePath: string): string {
  // If path doesn't exist or isn't a directory, fall back to current working directory
  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    if (process.env.NODE_ENV !== 'test') {
      logCallback(`Invalid workspace path: ${workspacePath}, falling back to cwd`, 'warn');
    }
    return process.cwd();
  }
  // Return absolute path to avoid any relative path issues
  return path.resolve(workspacePath);
}

export async function startMCPServer(workspacePath: string, isTest = false) {
  if (isTest) {
    process.env.NODE_ENV = 'test';
  }
  
  const config = await getServerConfig(isTest);
  const validWorkspacePath = validateWorkspacePath(workspacePath);
  if (process.env.NODE_ENV !== 'test') {
    logCallback(`Starting server with config: ${JSON.stringify(config)}`);
  }
  
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
      if (!allowed && process.env.NODE_ENV !== 'test') {
        logCallback(`Rejected connection from unauthorized origin: ${origin}`, 'warn');
      } else if (process.env.NODE_ENV !== 'test') {
        logCallback(`Accepted connection from origin: ${origin}`);
      }
      return allowed;
    }
  });

  // Wait for both HTTP and WebSocket servers to be ready
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Server failed to start within 5 seconds'));
    }, 5000);

    let httpReady = false;
    let wsReady = false;

    function checkReady() {
      if (httpReady && wsReady) {
        clearTimeout(timeoutId);
        resolve();
      }
    }

    server.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    wss.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    // Listen for HTTP server ready
    server.listen(config.port, config.host, () => {
      httpReady = true;
      checkReady();
    });

    // Listen for WebSocket server ready
    wss.once('listening', () => {
      wsReady = true;
      checkReady();
    });
  });

  // Store rate limit information for each client
  const clientLimits = new Map<WebSocket, RateLimitInfo>();

  // Handle server errors
  wss.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      logCallback(`WebSocket server error: ${error.message}`, 'error');
    }
  });

  // WebSocket connection handling
  wss.on('connection', (ws, request) => {
    const clientIp = request.socket.remoteAddress;
    if (process.env.NODE_ENV !== 'test') {
      logCallback(`Client connected from ${clientIp}`, 'info');
    }

    // Send workspace path immediately on connection
    try {
      const workspaceMessage = JSON.stringify({
        type: 'WORKSPACE_PATH',
        path: validWorkspacePath,
        serverPort: config.port
      });
      if (process.env.NODE_ENV !== 'test') {
        logCallback(`Sending workspace path message: ${workspaceMessage}`, 'info');
      }
      ws.send(workspaceMessage);
      if (process.env.NODE_ENV !== 'test') {
        logCallback('Workspace path message sent successfully', 'info');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logCallback(`Failed to send workspace path: ${error}`, 'error');
      }
    }

    // Initialize rate limit for client
    clientLimits.set(ws, {
      count: 0,
      resetTime: Date.now() + config.rateLimit.windowMs
    });

    // Handle client errors
    ws.on('error', (error) => {
      if (process.env.NODE_ENV !== 'test') {
        logCallback(`WebSocket client error: ${error.message}`, 'error');
      }
      ws.close();
    });

    ws.on('message', async (message) => {
      try {
        // Check rate limit
        const limit = clientLimits.get(ws);
        if (!limit) {
          if (process.env.NODE_ENV !== 'test') {
            logCallback('Rate limit info not found for client', 'error');
          }
          ws.close();
          return;
        }

        // Reset counter if window has passed
        if (Date.now() > limit.resetTime) {
          limit.count = 0;
          limit.resetTime = Date.now() + config.rateLimit.windowMs;
        }

        // Check if rate limit exceeded
        if (limit.count >= config.rateLimit.maxRequestsPerMinute) {
          if (process.env.NODE_ENV !== 'test') {
            logCallback(`Rate limit exceeded for client ${clientIp}`, 'warn');
          }
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: 'Rate limit exceeded'
          }));
          return;
        }

        // Increment counter
        limit.count++;

        const data = JSON.parse(message.toString());
        if (process.env.NODE_ENV !== 'test') {
          logCallback(`Received message from ${clientIp}: ${JSON.stringify(data)}`, 'info');
        }

        if (data.type === 'SELECT_TOOL') {
          const toolSelection: ToolSelection = data.payload;
          if (process.env.NODE_ENV !== 'test') {
            logCallback(`Processing tool selection: ${JSON.stringify(toolSelection)}`, 'info');
          }
          
          // Validate the tool selection
          if (!toolSelection || !toolSelection.name || !toolSelection.projectPath) {
            if (process.env.NODE_ENV !== 'test') {
              logCallback('Invalid tool selection: missing required fields', 'warn');
            }
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: 'Invalid tool selection'
            }));
            return;
          }

          try {
            const documentation = await fetchToolDocumentation(toolSelection);
            if (process.env.NODE_ENV !== 'test') {
              logCallback(`Documentation fetched successfully for ${toolSelection.name}`, 'info');
            }
            ws.send(JSON.stringify({
              type: 'DOCUMENTATION_UPDATED',
              payload: documentation
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (process.env.NODE_ENV !== 'test') {
              logCallback(`Error fetching documentation: ${errorMessage}`, 'error');
            }
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: `Failed to fetch documentation: ${errorMessage}`
            }));
          }
        } else {
          if (process.env.NODE_ENV !== 'test') {
            logCallback(`Unknown message type: ${data.type}`, 'warn');
          }
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: 'Unknown message type'
          }));
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          logCallback('Error parsing message', 'error');
        }
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      if (process.env.NODE_ENV !== 'test') {
        logCallback(`Client disconnected: ${clientIp}`, 'info');
      }
      clientLimits.delete(ws);
    });
  });

  return server;
} 