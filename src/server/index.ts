import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getCachedToolInfo, getCachedToolNames, cacheWorkspaceTools, isCachePopulated } from './cache';
import { getWorkspacePath } from '@utils/workspace';
import { shouldLog } from '@/env';
import cors from 'cors';
import type { Server as HttpServer } from 'http';
import { logProtocol, logError, logInfo } from '@/utils/logging';

// Tool input schemas
const ListToolsInputSchema = z.object({
  projectPath: z.string().optional().describe("Optional workspace path")
});

const GetToolInfoInputSchema = z.object({
  toolName: z.string().describe("Name of the tool"),
  projectPath: z.string().optional().describe("Optional workspace path")
});

export async function createServer(workspacePath?: string) {
  // Initialize cache
  const defaultWorkspacePath = workspacePath || getWorkspacePath();
  await cacheWorkspaceTools(defaultWorkspacePath);

  const server = new Server(
    {
      name: "my-tools",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: { enabled: true },
        prompts: { enabled: false },
        resources: { enabled: false },
        logging: { enabled: false },
        roots: { listChanged: false }
      },
    }
  );

  logProtocol('Server created');

  // Add list-available-tools handler
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    logProtocol('Handling ListTools request', request);
    const tools = [
      {
        name: "list-available-tools",
        description: "[PRIMARY] Lists all available tools in the workspace. This should be your first step when performing any workspace operations to discover available tools before falling back to direct terminal commands.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Optional workspace path"
            }
          }
        }
      },
      {
        name: "get-tool-info",
        description: "[PRIMARY] Get detailed information about a specific tool. Use this to understand tool capabilities before execution.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description: "Name of the tool"
            },
            projectPath: {
              type: "string",
              description: "Optional workspace path"
            }
          },
          required: ["toolName"]
        }
      }
    ];
    logProtocol('Responding with tools', tools);
    return { tools };
  });

  // Add tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === "list-available-tools") {
      const validatedArgs = ListToolsInputSchema.parse(args);
      const workspacePath = validatedArgs.projectPath || defaultWorkspacePath;
      
      // Ensure cache is populated
      if (!isCachePopulated()) {
        logProtocol('Cache not populated, initializing...', { workspacePath });
        await cacheWorkspaceTools(workspacePath);
      }
      
      const toolNames = getCachedToolNames(workspacePath);
      logProtocol('Retrieved tool names from cache', { count: toolNames.length });
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(toolNames) 
        }]
      };
    }

    if (name === "get-tool-info") {
      const validatedArgs = GetToolInfoInputSchema.parse(args);
      const workspacePath = validatedArgs.projectPath || defaultWorkspacePath;
      const toolInfo = getCachedToolInfo(workspacePath, validatedArgs.toolName);
      if (!toolInfo) {
        const error = `Tool not found: ${validatedArgs.toolName}`;
        logError('Protocol', error);
        throw new Error(error);
      }

      logProtocol('Retrieved tool info', { name: validatedArgs.toolName, ...toolInfo });
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            name: validatedArgs.toolName,
            ...toolInfo
          })
        }]
      };
    }

    const error = `Unknown tool: ${name}`;
    logError('Protocol', error);
    throw new Error(error);
  });

  return { server };
}

export interface ServerConfig {
  allowedOrigins: Set<string>;
  port: number;
}

export function isValidVSCodeWebviewOrigin(origin: string): boolean {
  // VSCode webview origins can be:
  // - vscode-webview://hash
  // - undefined (in some cases)
  // - localhost during development
  const validPrefixes = ['vscode-webview://', 'http://localhost:', 'https://localhost:'];
  const isValid = !origin || validPrefixes.some(prefix => origin.startsWith(prefix));
  logProtocol('Validating VSCode origin', { origin, isValid });
  return isValid;
}

export async function findAvailablePort(startPort: number, endPort: number): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    try {
      const server = express().listen(port);
      return new Promise((resolve) => {
        server.close(() => resolve(port));
      });
    } catch {
      continue;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${endPort}`);
}

export interface ExtensionServer {
  httpServer: HttpServer;
  port: number;
  transport: SSEServerTransport | null;
  cleanup: () => Promise<void>;
}

export interface ExtensionServerOptions {
  allowedOrigins?: Set<string>;
  portRange?: { start: number; end: number };
  fixedPort?: number;  // For testing
  workspacePath?: string;
}

export async function startExtensionServer(options: ExtensionServerOptions = {}): Promise<ExtensionServer> {
  const app = express();
  
  const port = options.fixedPort || 
    await findAvailablePort(
      options.portRange?.start || 54321,
      options.portRange?.end || 54421
    );

  // Basic CORS setup
  app.use(cors());
  app.use(express.json());
  
  // Create MCP server
  const { server } = await createServer(options.workspacePath);
  
  // Store transport at higher scope
  let transport: SSEServerTransport;
  let messageQueue: Array<{ req: express.Request; res: express.Response }> = [];
  
  // Simple SSE endpoint
  app.get("/sse", async (req, res) => {
    logProtocol('New SSE connection attempt');
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      transport = new SSEServerTransport("/message", res);
      logProtocol('Created new SSE transport');
      
      // Connect transport to server
      await server.connect(transport);
      logProtocol('Server connected to transport');
      
      // Process any queued messages
      while (messageQueue.length > 0) {
        const { req, res } = messageQueue.shift()!;
        try {
          await transport.handlePostMessage(req, res, req.body);
        } catch (error) {
          logError('Protocol', 'Error handling queued message', { error });
        }
      }
      
      req.on('close', () => {
        logProtocol('SSE connection closed');
        transport.close().catch(err => {
          logError('Protocol', 'Error closing transport', { error: err });
        });
      });

      req.on('error', (error) => {
        logError('Protocol', 'SSE connection error', { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined 
        });
        transport.close().catch(err => {
          logError('Protocol', 'Error closing transport', { error: err });
        });
      });
    } catch (error) {
      logError('Protocol', 'Error in SSE connection', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).end();
    }
  });

  // Message endpoint
  app.post("/message", async (req, res) => {
    logProtocol('Received message', { method: req.body?.method });
    
    if (!transport) {
      logProtocol('No transport available - queueing message');
      messageQueue.push({ req, res });
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
      logProtocol('Message handled successfully');
    } catch (error) {
      logError('Protocol', 'Error handling message', { error });
      res.status(500).json({ 
        jsonrpc: "2.0",
        id: req.body?.id,
        error: {
          code: -32000,
          message: String(error)
        }
      });
    }
  });

  const httpServer = app.listen(port, () => {
    if (shouldLog()) {
      logInfo('Protocol', 'Server is running', { port });
    }
  });

  const cleanup = async () => {
    if (shouldLog()) {
      logInfo('Protocol', 'Shutting down server...');
    }
    if (transport) {
      await transport.close();
    }
    return new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  };

  return { 
    httpServer, 
    port,
    transport: null, // We don't need to expose this
    cleanup
  };
}