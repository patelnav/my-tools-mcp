# Details.MD

This document provides a **comprehensive, step-by-step guide** for implementing a VSCode/Cursor extension that serves as an MCP-connected command-line tool documentation server. The extension includes both the MCP server and a UI panel for tool management.

---

## Table of Contents

- [Details.MD](#detailsmd)
  - [Table of Contents](#table-of-contents)
  - [1. Project Structure](#1-project-structure)
    - [Layout](#layout)
  - [2. Extension Setup](#2-extension-setup)
    - [Key Components](#key-components)
  - [3. MCP Server Implementation](#3-mcp-server-implementation)
    - [Components](#components)
  - [4. WebView Panel UI](#4-webview-panel-ui)
    - [Implementation](#implementation)
  - [5. Tool Documentation Logic](#5-tool-documentation-logic)
    - [Implementation](#implementation-1)
  - [6. Testing \& Validation](#6-testing--validation)
    - [Test Types](#test-types)
  - [7. Packaging \& Distribution](#7-packaging--distribution)
    - [Steps](#steps)
  - [Final Notes](#final-notes)

---

## 1. Project Structure

**Goal:** Structure the project as a VSCode/Cursor extension that includes an MCP server and UI panel.

### Layout

```
my-tools-mcp/
├── extension/                      # VSCode/Cursor extension
│   ├── src/
│   │   ├── extension.ts           # Main extension entry
│   │   ├── server/                # Built-in MCP server
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── controllers/      # Tool documentation logic
│   │   │   └── utils/           # Shared utilities
│   │   └── panel/                # WebView panel UI
│   │       ├── App.tsx          # Main React component
│   │       ├── components/      # UI components
│   │       └── hooks/          # Custom React hooks
│   ├── package.json              # Extension + dependencies
│   └── webpack.config.js         # Bundle configuration
│
├── shared/                       # Shared types and utilities
│   └── src/
│       ├── types.ts             # Shared TypeScript types
│       └── constants.ts         # Shared constants
│
└── package.json                 # Root package.json
```

## 2. Extension Setup

**Goal:** Create a VSCode/Cursor extension that manages both the MCP server and UI panel.

### Key Components

1. **Extension Entry Point** (`extension.ts`)
   ```typescript
   export function activate(context: vscode.ExtensionContext) {
     // Start MCP server
     const server = startMCPServer();
     
     // Register commands
     const disposable = vscode.commands.registerCommand('myTools.openPanel', () => {
       MyToolsPanel.createOrShow(context.extensionUri);
     });

     // Show MCP URL in status bar
     const statusBar = vscode.window.createStatusBarItem();
     statusBar.text = "MCP URL: http://localhost:8080";
     statusBar.show();
     
     context.subscriptions.push(disposable, statusBar);
   }
   ```

2. **WebView Panel**
   ```typescript
   class MyToolsPanel {
     public static currentPanel: MyToolsPanel | undefined;
     private readonly _panel: vscode.WebviewPanel;
     
     public static createOrShow(extensionUri: vscode.Uri) {
       if (MyToolsPanel.currentPanel) {
         MyToolsPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
         return;
       }

       const panel = vscode.window.createWebviewPanel(
         'myTools',
         'MCP Tools',
         vscode.ViewColumn.One,
         { enableScripts: true }
       );

       MyToolsPanel.currentPanel = new MyToolsPanel(panel, extensionUri);
     }
   }
   ```

## 3. MCP Server Implementation

**Goal:** Implement an MCP-compliant server within the extension.

### Components

1. **Server Setup**
   ```typescript
   import express from 'express';
   import { WebSocketServer } from 'ws';
   import { createServer } from 'http';

   export function startMCPServer() {
     const app = express();
     const server = createServer(app);
     const wss = new WebSocketServer({ server });

     // WebSocket handling
     wss.on('connection', handleWebSocket);

     server.listen(8080);
     return server;
   }
   ```

2. **Tool Documentation Controller**
   ```typescript
   async function handleToolRequest(tool: ToolSelection): Promise<Documentation> {
     const helpText = await executeToolCommand(tool.name, '-h');
     const version = await executeToolCommand(tool.name, '--version');
     
     return {
       name: tool.name,
       version,
       helpText,
       lastUpdated: new Date().toISOString()
     };
   }
   ```

## 4. WebView Panel UI

**Goal:** Create a React-based UI that runs in the VSCode/Cursor WebView panel.

### Implementation

1. **Panel HTML**
   ```typescript
   private _getHtmlForWebview() {
     const webview = this._panel.webview;
     const scriptUri = webview.asWebviewUri(
       vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
     );

     return `<!DOCTYPE html>
       <html>
         <head>
           <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width,initial-scale=1.0">
           <script type="module" src="${scriptUri}"></script>
         </head>
         <body>
           <div id="root"></div>
         </body>
       </html>`;
   }
   ```

2. **React Components**
   ```typescript
   function App() {
     const [tools, setTools] = useState<Tool[]>([]);
     const vscode = acquireVsCodeApi();

     useEffect(() => {
       // Handle messages from extension
       window.addEventListener('message', handleMessage);
     }, []);

     return (
       <div className="container">
         <ToolSelector onSelect={handleToolSelect} />
         <DocumentationViewer tool={selectedTool} />
       </div>
     );
   }
   ```

## 5. Tool Documentation Logic

**Goal:** Implement tool documentation fetching and caching.

### Implementation

1. **Command Execution**
   ```typescript
   async function executeToolCommand(
     toolName: string,
     args: string[]
   ): Promise<string> {
     return new Promise((resolve, reject) => {
       const process = spawn(toolName, args);
       let output = '';
       
       process.stdout.on('data', (data) => {
         output += data.toString();
       });

       process.on('close', (code) => {
         if (code === 0) resolve(output);
         else reject(new Error(`Exit code: ${code}`));
       });
     });
   }
   ```

2. **Caching**
   ```typescript
   const documentationCache = new Map<string, Documentation>();

   function getCachedDocumentation(tool: string): Documentation | null {
     return documentationCache.get(tool) || null;
   }
   ```

## 6. Testing & Validation

**Goal:** Ensure the extension, MCP server, and UI work correctly.

### Test Types

1. **Extension Tests**
   - Verify extension activation
   - Test WebView panel creation
   - Validate MCP server startup

2. **Integration Tests**
   - Test WebSocket communication
   - Verify tool documentation fetching
   - Check caching behavior

3. **UI Tests**
   - Test React component rendering
   - Verify user interactions
   - Check error handling

## 7. Packaging & Distribution

**Goal:** Package and distribute the extension with MCP capabilities.

### Steps

1. **Extension Packaging**
   ```json
   {
     "name": "mcp-tools",
     "displayName": "MCP Tools",
     "version": "1.0.0",
     "engines": {
       "vscode": "^1.60.0"
     },
     "activationEvents": [
       "onCommand:myTools.openPanel"
     ],
     "contributes": {
       "commands": [{
         "command": "myTools.openPanel",
         "title": "Open MCP Tools"
       }]
     }
   }
   ```

2. **Distribution**
   - Publish to VSCode Marketplace
   - Add to Cursor extension registry
   - Create documentation for MCP client configuration

## Final Notes

- The extension provides both the MCP server and UI interface
- Users only need to install the extension and configure the MCP URL
- All tool management is done through the extension's UI panel
- Consider contributing to the MCP ecosystem

**Done!** You now have all the details for implementing a VSCode/Cursor extension that serves as an MCP-connected command-line documentation server.