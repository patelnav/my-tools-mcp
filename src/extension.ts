import * as vscode from 'vscode';
import { startMCPServer, setLogCallback } from './server';
import { MyToolsPanel } from './panel/MyToolsPanel';
import http from 'http';
import type { AddressInfo } from 'net';
import { getWorkspacePath } from './utils/workspace';
import type { WebSocketServer } from 'ws';

let mcpServer: http.Server | undefined;
let mcpWss: WebSocketServer | undefined;
let serverPromise: Promise<{ httpServer: http.Server; wsServer: WebSocketServer }> | undefined;
let serverStatusItem: vscode.StatusBarItem;

// Debug mode configuration
const DEBUG_MODE = true;
let debugStatusBar: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let isDebugInitialized = false;

// Export for testing
export function getServer(): http.Server | undefined {
  return mcpServer;
}

function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  // Always log to console regardless of debug mode
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}][MCP] `;
  switch (type) {
    case 'error':
      console.error(prefix + message);
      break;
    case 'warn':
      console.warn(prefix + message);
      break;
    default:
      console.log(prefix + message);
  }

  // Only use VS Code debug features if properly initialized
  if (!DEBUG_MODE || !isDebugInitialized) return;

  try {
    outputChannel?.appendLine(prefix + message);
    
    if (!debugStatusBar) return;

    if (type === 'error') {
      debugStatusBar.text = "$(error) MCP Debug: Error";
      debugStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (type === 'warn') {
      debugStatusBar.text = "$(warning) MCP Debug: Warning";
      debugStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      debugStatusBar.text = "$(bug) MCP Debug: Active";
      debugStatusBar.backgroundColor = undefined;
    }
  } catch (error) {
    console.error('Error in debug logging:', error);
  }
}

function setupDebugMode(context: vscode.ExtensionContext): boolean {
  if (!DEBUG_MODE) return false;

  try {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('MCP Debug');
    context.subscriptions.push(outputChannel);

    // Create status bar item for debug status
    debugStatusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1000
    );
    debugStatusBar.text = "$(bug) MCP Debug: Starting...";
    debugStatusBar.tooltip = "Click to show MCP debug logs";
    debugStatusBar.command = 'mcpTools.showDebugLogs';
    debugStatusBar.show();
    context.subscriptions.push(debugStatusBar);

    // Register command to show debug logs
    context.subscriptions.push(
      vscode.commands.registerCommand('mcpTools.showDebugLogs', () => {
        outputChannel?.show();
      })
    );

    isDebugInitialized = true;
    log('Debug mode initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize debug mode:', error);
    return false;
  }
}

// Export for testing
export function getServerPort(server: http.Server | undefined): number | undefined {
  if (!server) {
    log('Server is undefined when getting port', 'warn');
    return undefined;
  }

  try {
    const address = server.address();
    
    if (!address) {
      log('Server address is null - server may not be listening yet', 'warn');
      return undefined;
    }
    
    if (typeof address === 'string') {
      log(`Server address is a string (${address}), expected AddressInfo object`, 'warn');
      return undefined;
    }
    
    const port = (address as AddressInfo).port;
    if (!port) {
      log('Server port is undefined or 0', 'warn');
      return undefined;
    }
    
    return port;
  } catch (error) {
    log(`Error getting server port: ${error}`, 'error');
    return undefined;
  }
}

async function checkServerHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      req.destroy();
      resolve(false);
    }, 1000); // Reduced from 2000ms to 1000ms

    // Use the current server port from config
    const serverPort = getServerPort(mcpServer);
    if (!serverPort) {
      clearTimeout(timeoutId);
      resolve(false);
      return;
    }

    const req = http.get(`http://localhost:${serverPort}/health`, {
      timeout: 1000, // Reduced from 2000ms to 1000ms
      headers: {
        'Accept': 'application/json'
      }
    }, (res) => {
      clearTimeout(timeoutId);
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      clearTimeout(timeoutId);
      resolve(false);
    });
  });
}

async function updateServerStatus() {
  if (!serverStatusItem || !mcpServer) return;

  const isHealthy = await checkServerHealth();
  if (isHealthy) {
    const serverPort = getServerPort(mcpServer);
    serverStatusItem.text = `$(radio-tower) MCP: Connected (${serverPort})`;
    serverStatusItem.backgroundColor = undefined;
    // Only log health check on state change
    if (serverStatusItem.tooltip !== 'Connected') {
      log(`Server health check passed on port ${serverPort}`);
      serverStatusItem.tooltip = 'Connected';
    }
  } else {
    serverStatusItem.text = "$(warning) MCP: Disconnected";
    serverStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    // Only log health check failure on state change
    if (serverStatusItem.tooltip !== 'Disconnected') {
      log('Server health check failed', 'warn');
      serverStatusItem.tooltip = 'Disconnected';
    }
  }
}

async function tryStartServer(): Promise<http.Server> {
  try {
    // Get workspace path - will throw if invalid
    const workspacePath = getWorkspacePath();
    
    // Start MCP server with workspace path
    log(`Starting MCP server with path: ${workspacePath}`);
    const isTest = process.env.VSCODE_TEST === 'true';
    serverPromise = startMCPServer(workspacePath, isTest);
    
    // Add timeout to server startup
    const timeoutPromise = new Promise<{ httpServer: http.Server; wsServer: WebSocketServer }>((_, reject) => {
      setTimeout(() => reject(new Error('Server startup timed out after 30s')), 30000);
    });
    
    log('Waiting for server to start...');
    const { httpServer, wsServer } = await Promise.race([serverPromise, timeoutPromise]);
    mcpServer = httpServer;
    mcpWss = wsServer;
    
    if (!mcpServer) {
      throw new Error('Server failed to start - server instance is undefined');
    }
    
    log('Server instance created, waiting for listening event...');
    
    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      if (!mcpServer) {
        reject(new Error('Server instance is undefined'));
        return;
      }
      
      if (mcpServer.listening) {
        log('Server is already listening');
        resolve();
        return;
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error('Server failed to start listening within 5s'));
      }, 5000);
      
      mcpServer.once('listening', () => {
        clearTimeout(timeoutId);
        log('Server listening event received');
        resolve();
      });
      
      mcpServer.once('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
    
    // Verify server is healthy
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      throw new Error('Server health check failed after startup');
    }
    
    log('Server started successfully');
    return mcpServer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error starting server: ${message}`, 'error');
    throw error;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  log('MCP Tools extension is activating');

  // Initialize debug mode
  setupDebugMode(context);

  try {
    // Set up logging callback
    setLogCallback(log);

    // Create status bar item
    serverStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    serverStatusItem.text = "$(sync~spin) MCP: Starting...";
    serverStatusItem.show();
    context.subscriptions.push(serverStatusItem);

    // Start server
    const server = await tryStartServer();
    const port = getServerPort(server);
    
    if (!port) {
      throw new Error('Failed to get server port after startup');
    }

    // Create WebView panel
    MyToolsPanel.createOrShow(context.extensionUri, port);
    
    // Register command to open panel
    let disposable = vscode.commands.registerCommand('mcpTools.openPanel', () => {
      MyToolsPanel.createOrShow(context.extensionUri, port);
    });
    
    context.subscriptions.push(disposable);

    // Update server status periodically
    setInterval(() => updateServerStatus(), 5000);

    log('Extension activated successfully');

    // Return exports for testing
    return {
      getWebviewPanel: () => MyToolsPanel.getWebviewPanel(),
      getServerPort: () => getServerPort(mcpServer)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Extension activation failed: ${message}`, 'error');
    throw error;
  }
}

export function deactivate() {
  if (mcpWss) {
    mcpWss.close();
  }
  if (mcpServer) {
    mcpServer.close();
  }
} 