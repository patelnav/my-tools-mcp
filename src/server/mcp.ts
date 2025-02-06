import { FastMCP } from "fastmcp";
import { z } from "zod";
import { getCachedToolInfo, getCachedToolNames } from './cache';
import { getWorkspacePath } from '../utils/workspace';

// Response types
interface TextContent {
  type: "text";
  text: string;
}

interface ToolInfo {
  name: string;
  helpText: string;
  isExecutable: boolean;
  lastUpdated: number;
}

interface ErrorResponse {
  error: string;
  toolName?: string;
  workspace?: string;
}

/**
 * Create and configure MCP server
 */
export async function createMcpServer(logFn: (message: string, type?: 'info' | 'error' | 'warn') => void) {
  // Create FastMCP server
  const server = new FastMCP({
    name: "my-tools",
    version: "1.0.0"
  });

  // Add list-available-tools tool
  server.addTool({
    name: "list-available-tools",
    description: "Lists all available tools in the workspace",
    parameters: z.object({
      projectPath: z.string().optional().describe("Optional workspace path")
    }),
    execute: async (args: { projectPath?: string }): Promise<TextContent> => {
      logFn('Handling list-available-tools request');
      const wsPath = args.projectPath || getWorkspacePath();
      const toolNames = getCachedToolNames(wsPath);
      logFn(`Listing ${toolNames.length} tools for workspace: ${wsPath}`);
      return {
        type: "text",
        text: JSON.stringify(toolNames)
      };
    }
  });

  // Add get-tool-info tool
  server.addTool({
    name: "get-tool-info",
    description: "Get detailed information about a specific tool",
    parameters: z.object({
      toolName: z.string().describe("Name of the tool"),
      projectPath: z.string().optional().describe("Optional workspace path")
    }),
    execute: async (args: { toolName: string, projectPath?: string }): Promise<TextContent> => {
      logFn('Handling get-tool-info request');
      const wsPath = args.projectPath || getWorkspacePath();
      const toolInfo = getCachedToolInfo(wsPath, args.toolName);

      if (!toolInfo) {
        logFn(`Tool not found: ${args.toolName} in workspace: ${wsPath}`, 'warn');
        const errorResponse: ErrorResponse = {
          error: "Tool not found",
          toolName: args.toolName,
          workspace: wsPath
        };
        return {
          type: "text",
          text: JSON.stringify(errorResponse)
        };
      }

      logFn(`Retrieved info for tool: ${args.toolName}`);
      const response: ToolInfo = {
        name: args.toolName,
        ...toolInfo
      };
      return {
        type: "text",
        text: JSON.stringify(response)
      };
    }
  });

  return server;
}

/**
 * Start MCP server
 */
export async function startMcpServer(logFn: (message: string, type?: 'info' | 'error' | 'warn') => void) {
  try {
    const server = await createMcpServer(logFn);
    return server;
  } catch (error) {
    logFn(`Failed to start MCP server: ${error}`, 'error');
    throw error;
  }
}

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer(console.log).then(server => {
    server.start({
      transportType: "sse",
      sse: {
        endpoint: "/sse",
        port: 8080
      }
    });
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} 