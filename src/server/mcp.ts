/**
 * ARCHIVE NOTE: This was a simple test implementation of the MCP server that worked successfully.
 * We're keeping this as a reference implementation while moving the production code to index.ts.
 * This demonstrates the basic setup of an MCP server with tool discovery and documentation features.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getCachedToolInfo, getCachedToolNames, cacheWorkspaceTools } from './cache';
import { getWorkspacePath } from '../utils/workspace';

const app = express();
const PORT = 54321;

// Tool input schemas
const ListToolsInputSchema = z.object({
  projectPath: z.string().optional().describe("Optional workspace path")
});

const GetToolInfoInputSchema = z.object({
  toolName: z.string().describe("Name of the tool"),
  projectPath: z.string().optional().describe("Optional workspace path")
});

export async function createServer() {
  // Initialize cache
  const defaultWorkspacePath = getWorkspacePath();
  await cacheWorkspaceTools(defaultWorkspacePath);

  const server = new Server(
    {
      name: "my-tools",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Add list-available-tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: "list-available-tools",
        description: "Lists all available tools in the workspace",
        inputSchema: zodToJsonSchema(ListToolsInputSchema, { name: "list-tools" })
      },
      {
        name: "get-tool-info",
        description: "Get detailed information about a specific tool",
        inputSchema: zodToJsonSchema(GetToolInfoInputSchema, { name: "get-tool-info" })
      }
    ];

    return { tools };
  });

  // Add tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === "list-available-tools") {
      const validatedArgs = ListToolsInputSchema.parse(args);
      const workspacePath = validatedArgs.projectPath || defaultWorkspacePath;
      const toolNames = getCachedToolNames(workspacePath);
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
        throw new Error(`Tool not found: ${validatedArgs.toolName}`);
      }

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

    throw new Error(`Unknown tool: ${name}`);
  });

  return { server };
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().then(({ server }) => {
    let transport: SSEServerTransport;

    app.get("/sse", async (req, res) => {
      console.log("Received SSE connection");
      transport = new SSEServerTransport("/message", res);
      await server.connect(transport);

      req.on('close', async () => {
        console.log("Connection closed");
        await transport.close();
      });
    });

    app.post("/message", async (req, res) => {
      console.log("Received message");
      if (!transport) {
        console.error("No transport available");
        res.status(500).end();
        return;
      }
      await transport.handlePostMessage(req, res);
    });

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}/sse`);
    });

    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      if (transport) {
        await transport.close();
      }
      process.exit(0);
    });
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} 