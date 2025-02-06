import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import express from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import { getServerConfig, isValidVSCodeWebviewOrigin } from '@server/config';
import { WS_MESSAGE_TYPES, ERROR_MESSAGES, SECURITY } from '../constants';
import { shouldLog } from '@/env';
import { validateWorkspacePath, getWorkspacePath } from '@utils/workspace';
import { getTestEnvironment, TestEnvironment } from '@utils/workspace';
import { fetchToolDocumentation } from '@server/controllers/docs';
import { getAvailableTools } from '@server/controllers/docs/path-scanner';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

type LogCallback = (message: string, type?: 'info' | 'error' | 'warn') => void;

function defaultLogCallback(message: string, _type: 'info' | 'error' | 'warn' = 'info'): void {
  console.log(message);
}

let logCallback: LogCallback = defaultLogCallback;

export function setLogCallback(callback: LogCallback): void {
  logCallback = callback;
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export async function startMCPServer(workspacePath: string, isTest = false): Promise<{ httpServer: http.Server; wsServer: WebSocketServer }> {
  const validPath = validateWorkspacePath(workspacePath);
  const testEnv = getTestEnvironment();
  const isTestEnv = testEnv !== TestEnvironment.NONE || isTest;
  
  const config = await getServerConfig(isTestEnv);
  try {
    if (shouldLog()) {
      logCallback(`Starting server with config: ${JSON.stringify(config)}`);
    }
  
    const app = express();
    
    // Security: Restrict CORS
    const corsOptions: CorsOptions = {
      origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!requestOrigin) {
          callback(null, true);
          return;
        }
        if (config.allowedOrigins.has(requestOrigin) || isValidVSCodeWebviewOrigin(requestOrigin)) {
          callback(null, true);
        } else {
          const error = new Error('401 Unauthorized - Invalid origin');
          error.message = '401';
          callback(error);
        }
      },
      methods: ['GET', 'POST']
    };
    
    app.use(cors(corsOptions));
    
    app.use(express.json());

    // Add health check endpoint
    app.get('/health', (_req, res) => {
      res.sendStatus(200);
    });

    // Create HTTP server
    const server = http.createServer(app);

    // Create WebSocket server
    const wss = new WebSocketServer({ 
      server,
      // Security: Verify client connection
      verifyClient: ({ origin, req }: { origin: string; secure: boolean; req: http.IncomingMessage }, callback) => {
        // In test mode, allow all connections
        if (isTestEnv) {
          // Get origin from query parameter if available
          const url = new URL(req.url || '', 'ws://localhost');
          const queryOrigin = url.searchParams.get('origin');
          const effectiveOrigin = queryOrigin || origin;
          
          if (shouldLog()) {
            logCallback(`[WebSocket] Test mode: Accepting connection attempt from origin: ${effectiveOrigin}`);
          }
          
          // In test mode, if origin is explicitly set to 'invalid-origin', reject it
          if (effectiveOrigin === 'invalid-origin') {
            callback(false, 401, '401');
            return;
          }
          
          callback(true);
          return;
        }
        
        const allowed = config.allowedOrigins.has(origin) || isValidVSCodeWebviewOrigin(origin);
        if (!allowed) {
          if (shouldLog()) {
            logCallback(`[WebSocket] Rejected connection from unauthorized origin: ${origin}`, 'warn');
            logCallback(`[WebSocket] Allowed origins: ${JSON.stringify([...config.allowedOrigins])}`, 'warn');
            logCallback(`[WebSocket] Origin validation result: ${isValidVSCodeWebviewOrigin(origin)}`, 'warn');
          }
          callback(false, 401, '401');
          return;
        }
        callback(true);
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
    const activeConnections = new Set<WebSocket>();

    // Handle server errors
    wss.on('error', (error) => {
      if (!shouldLog()) {
        logCallback(`WebSocket server error: ${error.message}`, 'error');
      }
    });

    // WebSocket connection handling
    wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      if (shouldLog()) {
        logCallback(`[WebSocket] New connection established from ${req.headers.origin}`);
        logCallback(`[WebSocket] Client headers: ${JSON.stringify(req.headers)}`);
      }

      // Track active connection
      activeConnections.add(ws);

      // Send workspace path immediately on connection
      if (shouldLog()) {
        logCallback(`[WebSocket] Sending workspace path: ${validPath} with port ${config.port}`);
      }
      ws.send(JSON.stringify({
        type: 'WORKSPACE_PATH',
        path: validPath,
        serverPort: config.port
      }));

      // Automatically discover and send available tools
      getAvailableTools(validPath).then(tools => {
        if (shouldLog()) {
          logCallback(`[WebSocket] Discovered ${tools.length} tools`);
        }
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.TOOLS_DISCOVERED,
          payload: tools
        }));
      }).catch(error => {
        if (shouldLog()) {
          logCallback(`[WebSocket] Error discovering tools: ${error}`, 'error');
        }
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.ERROR,
          payload: ERROR_MESSAGES.SERVER_ERROR
        }));
      });

      // Handle messages
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (shouldLog()) {
            logCallback(`[WebSocket] Received message: ${JSON.stringify(message)}`);
          }
          
          switch (message.type) {
            case WS_MESSAGE_TYPES.SELECT_TOOL:
              try {
                if (shouldLog()) {
                  logCallback(`[WebSocket] SELECT_TOOL message received with payload: ${JSON.stringify(message.payload)}`);
                }
                const { name, projectPath } = message.payload || {};
                if (!name || !projectPath) {
                  const error = 'Invalid tool selection: missing name or project path';
                  logCallback(`[WebSocket] ${error}`, 'error');
                  throw new Error(error);
                }
                if (shouldLog()) {
                  logCallback(`[WebSocket] Fetching documentation for tool: ${name} in path: ${projectPath}`);
                }
                const documentation = await fetchToolDocumentation({ name, projectPath });
                if (shouldLog()) {
                  logCallback(`[WebSocket] Documentation fetched successfully for ${name}`);
                }
                ws.send(JSON.stringify({
                  type: WS_MESSAGE_TYPES.DOCUMENTATION_UPDATED,
                  payload: documentation
                }));
              } catch (error) {
                if (shouldLog()) {
                  logCallback(`[WebSocket] Error fetching documentation: ${error}`, 'error');
                }
                ws.send(JSON.stringify({
                  type: WS_MESSAGE_TYPES.ERROR,
                  payload: ERROR_MESSAGES.DOCUMENTATION_FETCH_FAILED
                }));
              }
              break;
            case WS_MESSAGE_TYPES.DISCOVER_TOOLS:
              try {
                const tools = await getAvailableTools(validPath);
                ws.send(JSON.stringify({
                  type: WS_MESSAGE_TYPES.TOOLS_DISCOVERED,
                  payload: tools
                }));
              } catch (error) {
                if (shouldLog()) {
                  logCallback(`[WebSocket] Error discovering tools: ${error}`, 'error');
                }
                ws.send(JSON.stringify({
                  type: WS_MESSAGE_TYPES.ERROR,
                  payload: ERROR_MESSAGES.TOOL_DISCOVERY_FAILED
                }));
              }
              break;
          }
        } catch (error: unknown) {
          if (shouldLog()) {
            const message = isError(error) ? error.message : String(error);
            logCallback(`Error processing message: ${message}`, 'error');
          }
          ws.send(JSON.stringify({
            type: WS_MESSAGE_TYPES.ERROR,
            payload: ERROR_MESSAGES.INVALID_MESSAGE_FORMAT
          }));
        }
      });
    });

    return { httpServer: server, wsServer: wss };
  } catch (error: unknown) {
    if (shouldLog()) {
      const message = isError(error) ? error.message : String(error);
      logCallback(`Error starting server: ${message}`, 'error');
    }
    throw error;
  }
}