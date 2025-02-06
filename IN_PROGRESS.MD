# Tool Documentation Server Plan

## Overview
Convert our tool documentation server to use Model Context Protocol (MCP) for both Cursor integration and our VS Code extension frontend.

## Current State
We already have:
- Tool discovery (`getAvailableTools`)
- Tool documentation (`getToolInfo`, `getToolHelpText`)
- Command execution for help text (`command-executor.ts`)
- Security and validation
- Frontend UI components

## Important Notes About Command Execution

1. **Limited Command Execution**:
   - Our server DOES need to execute specific commands, but only for:
     ```typescript
     // In help-fetcher.ts - for getting help text
     const result = await executeTool(tool, ['--help'], {
       timeout: 5000,
       maxOutputSize: 50000
     });

     // In command-executor.ts - for checking if tool exists
     const result = await executeTool(tool, ['--version'], {
       timeout: 2000,
       maxOutputSize: 1000
     });
     ```
   - These executions are:
     - Limited to help/version flags only
     - Have strict timeouts
     - Have output size limits
     - Run without shell access
     - Only used for documentation purposes

2. **Security Boundaries**:
   - Documentation Server:
     - CAN run `--help`, `-h`, `--version`, `-v` flags
     - CANNOT run actual tool commands
     - Has strict security measures in `command-executor.ts`
   - Tool Execution:
     - VS Code: Through extension's terminal API
     - Cursor: Through agent's terminal process

3. **Testing Implications**:
   - Development MCP server needs same permissions as production
   - Integration tests should verify:
     ```typescript
     test('get-tool-info includes help text', async () => {
       // This will actually run npm --help behind the scenes
       const result = await client.invoke('get-tool-info', {
         toolName: 'npm'
       });
       const info = JSON.parse(result.content[0].text);
       expect(info.helpText).toContain('npm <command>');
     });
     ```
   - Need to ensure test environment has tools installed

## Implementation Plan

### Phase 1: Setup Workspace-Aware Caching ✅
- [x] Create cache management module (src/server/cache.ts):
    ```typescript
    // Global cache map keyed by workspace path
    const workspaceToolCache = new Map<string, Map<string, ToolInfo>>();

    export async function cacheWorkspaceTools(workspacePath: string) {
      const toolCache = new Map();
      const tools = await getAvailableTools(workspacePath);
      
      for (const tool of tools) {
        const helpText = await getToolHelpText(tool, workspacePath);
        const isExecutable = await isToolExecutable(tool);
        toolCache.set(tool.name, { helpText, isExecutable });
      }
      
      workspaceToolCache.set(workspacePath, toolCache);
      return toolCache;
    }

    export function getWorkspaceCache(workspacePath: string) {
      return workspaceToolCache.get(workspacePath);
    }

    export function clearWorkspaceCache(workspacePath: string) {
      workspaceToolCache.delete(workspacePath);
    }
    ```

- [x] Update extension activation to cache per workspace

### Phase 2: Setup MCP Server ✅
- [x] Add @modelcontextprotocol/typescript-sdk dependency
- [x] Create src/server/mcp.ts that uses cached data

### Phase 3: Update Frontend 🚧
- [ ] Remove WebSocket code
- [ ] Add MCP client to frontend (src/panel/client.ts)
- [ ] Update React components to use MCP client
- [ ] Update types to match MCP responses
- [ ] Update error handling

### Phase 4: Cleanup ⏳
- [ ] Remove old WebSocket server code
- [ ] Update configuration
- [ ] Update VS Code extension activation events
- [ ] Update status bar and commands

## Future Improvements

### Workspace Change Detection
- Add workspace file watchers:
  ```typescript
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspacePath, '**/package.json')
  );

  watcher.onDidChange(async () => {
    await cacheWorkspaceTools(workspacePath);
  });
  ```
- Watch for:
  - Package.json changes (new tools)
  - Node modules changes
  - Workspace folder changes

### Cache Management
- Add cache invalidation strategies
- Add partial cache updates
- Add cache persistence between sessions
- Add cache size limits

## Current Status
Ready to begin Phase 1 (Workspace-Aware Caching)

## Notes
- Each workspace gets its own tool cache
- Cache is built during extension activation
- Cache is workspace-path aware for multi-root workspaces
- MCP server uses cached data only
- No direct command execution after activation

### Cursor Composer Integration
1. **Tool Registration**
   - Only two tools needed:
     ```typescript
     // List all available tools in workspace
     server.tool(
       "list-available-tools",
       { 
         projectPath: z.string().optional() 
       },
       async ({ projectPath }) => ({
         content: [{
           type: "text",
           text: JSON.stringify(await getAvailableTools(projectPath), null, 2)
         }]
       })
     );

     // Get detailed info about a specific tool
     server.tool(
       "get-tool-info",
       {
         toolName: z.string(),
         projectPath: z.string().optional()
       },
       async ({ toolName, projectPath }) => {
         const info = await getToolInfo(toolName, projectPath);
         const helpText = await getToolHelpText(toolName, projectPath);
         return {
           content: [{
             type: "text",
             text: JSON.stringify({
               ...info,
               helpText,
             }, null, 2)
           }]
         };
       })
     );
     ```

2. **Tool Discovery Flow**
   - When Cursor's agent needs to use a tool:
     1. Agent calls `list-available-tools` to discover what's available
     2. Agent calls `get-tool-info` to understand how to use a specific tool
     3. Agent uses its own terminal process to execute the tool

3. **Response Format**
   - Tool list response includes:
     - Tool name
     - Type (script, binary, package manager)
     - Category/group
     - Location and working directory
   - Tool info response includes:
     - All of the above
     - Help text
     - Version information (if available)

4. **Agent Interaction**
   - Agent discovers available tools
   - Agent gets documentation to understand tool usage
   - Agent executes tools through its own terminal process
   - No direct execution through our server

This simplified approach:
- Focuses on our core strength (tool discovery and documentation)
- Maintains better security (no execution through our server)
- Provides clear separation of concerns
- Makes integration simpler and more robust

### Tool Schema Examples
```typescript
// Tool discovery
server.tool(
  "list-available-tools",
  { 
    projectPath: z.string().optional() 
  },
  async ({ projectPath }) => ({
    content: [{
      type: "text",
      text: JSON.stringify(await getAvailableTools(projectPath))
    }]
  })
);

// Tool documentation
server.tool(
  "get-tool-help",
  {
    toolName: z.string(),
    projectPath: z.string().optional()
  },
  async ({ toolName, projectPath }) => ({
    content: [{
      type: "text",
      text: await getToolHelpText(toolName, projectPath)
    }]
  })
);

// Tool execution
server.tool(
  "run-tool",
  {
    toolName: z.string(),
    args: z.array(z.string()).optional(),
    projectPath: z.string().optional()
  },
  async ({ toolName, args, projectPath }) => ({
    content: [{
      type: "text",
      text: await executeToolAndGetOutput(toolName, args, projectPath)
    }]
  })
);
``` 