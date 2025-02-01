import * as vscode from 'vscode';
import { startMCPServer, setLogCallback } from './server';
import { MyToolsPanel } from './panel/MyToolsPanel';
import http from 'http';
import { AddressInfo } from 'net';

let mcpServer: http.Server | undefined;
let serverPromise: Promise<http.Server> | undefined;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
let serverStatusItem: vscode.StatusBarItem;

// Debug mode configuration
const DEBUG_MODE = true;
let debugStatusBar: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let isDebugInitialized = false;

function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  // Always log to console regardless of debug mode
  const prefix = `[MCP] `;
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
    const timestamp = new Date().toLocaleTimeString();
    const logPrefix = `[${timestamp}] `;
    
    outputChannel?.appendLine(logPrefix + message);
    
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

function getServerPort(server: http.Server | undefined): number | undefined {
  const address = server?.address();
  if (!address) return undefined;
  return typeof address === 'string' ? undefined : address.port;
}

async function checkServerHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      req.destroy();
      resolve(false);
    }, 2000);

    // Use the current server port from config
    const serverPort = getServerPort(mcpServer) || 8080;
    const req = http.get(`http://localhost:${serverPort}/health`, {
      timeout: 2000,
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
    log(`Server health check passed on port ${serverPort}`);
  } else {
    serverStatusItem.text = "$(warning) MCP: Disconnected";
    serverStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    log('Server health check failed', 'warn');
  }
}

async function tryStartServer() {
  try {
    // Get workspace path
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    log(`Starting server with workspace path: ${workspacePath}`);
    
    // Start MCP server with workspace path
    serverPromise = startMCPServer(workspacePath);
    mcpServer = await serverPromise;
    const serverPort = getServerPort(mcpServer);
    log(`Server started on port ${serverPort}`);

    // Create or update status bar item
    if (!serverStatusItem) {
      serverStatusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      serverStatusItem.tooltip = "Click to copy MCP URL";
      serverStatusItem.command = 'mcpTools.copyUrl';
    }
    serverStatusItem.show();

    // Start health check interval
    setInterval(updateServerStatus, 5000);

    log('Server started successfully');
    retryCount = 0; // Reset retry count on success
    
    // Initial status update
    await updateServerStatus();
  } catch (error) {
    const attempt = retryCount + 1;
    log(`Failed to start server (attempt ${attempt}/${MAX_RETRIES})`, 'warn');
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => tryStartServer(), RETRY_DELAY);
    } else {
      log('Failed to start server after maximum retries', 'error');
      vscode.window.showErrorMessage('Failed to start MCP server after multiple attempts');
    }
    throw error;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  log('MCP Tools extension is activating');
  
  // Initialize debug mode first
  const debugInitialized = setupDebugMode(context);
  if (!debugInitialized) {
    console.warn('Debug mode initialization failed, continuing without debug features');
  }

  // Connect server logging to our debug system
  setLogCallback(log);

  await tryStartServer();

  // Register commands
  let disposables = [
    vscode.commands.registerCommand('mcpTools.openPanel', () => {
      log('Opening MCP Tools panel');
      MyToolsPanel.createOrShow(context.extensionUri);
    }),

    vscode.commands.registerCommand('mcpTools.copyUrl', () => {
      if (!mcpServer) {
        vscode.window.showErrorMessage('MCP server is not running');
        return;
      }
      const serverPort = getServerPort(mcpServer);
      if (!serverPort) {
        vscode.window.showErrorMessage('Could not determine server port');
        return;
      }
      vscode.env.clipboard.writeText(`http://localhost:${serverPort}`).then(() => {
        log('MCP URL copied to clipboard');
        vscode.window.showInformationMessage('MCP URL copied to clipboard');
      });
    })
  ];

  if (serverStatusItem) {
    disposables.push(serverStatusItem);
  }

  context.subscriptions.push(...disposables);
}

export function deactivate() {
  if (mcpServer) {
    log('Shutting down MCP server');
    mcpServer.close(() => {
      log('MCP server closed successfully');
      if (serverStatusItem) {
        serverStatusItem.dispose();
      }
    });
  }
} 