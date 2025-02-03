import * as vscode from 'vscode';
import { startMCPServer, setLogCallback } from './server';
import { MyToolsPanel } from './panel/MyToolsPanel';
import http from 'http';
import { AddressInfo } from 'net';
import * as path from 'path';

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

// Add these constants at the top with other constants
const MCP_PORT_START = 54321;
const MCP_PORT_END = 54421;

// Test environment detection
const isTestEnvironment = process.env.VSCODE_TEST === '1';

function getWorkspacePath(): string {
    if (isTestEnvironment) {
        // In test environment, use the test-monorepo path
        return path.resolve(__dirname, '../__tests__/fixtures/test-monorepo');
    }
    
    // In normal environment, use workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    
    return process.cwd();
}

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

async function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = http.get(`http://localhost:${port}/health`, {
      timeout: 1000,
      headers: { 'Accept': 'application/json' }
    }, (res) => {
      // If we get any response, port is in use
      resolve(res.statusCode === 200);
    });
    
    tester.on('error', () => {
      resolve(false);
    });
  });
}

async function findExistingServer(): Promise<number | undefined> {
  log('Checking for existing MCP server...');
  
  for (let port = MCP_PORT_START; port <= MCP_PORT_END; port++) {
    if (await checkPortInUse(port)) {
      log(`Found existing server on port ${port}`);
      return port;
    }
  }
  
  log('No existing server found');
  return undefined;
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

async function tryStartServer(): Promise<number> {
  try {
    // First check if server is already running
    const existingPort = await findExistingServer();
    if (existingPort) {
      log(`Using existing MCP server on port ${existingPort}`);
      return existingPort;
    }
    
    // Get workspace path
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      log('No workspace folder found, using current working directory', 'warn');
    }
    
    // Start MCP server with workspace path
    log(`Starting MCP server with path: ${workspacePath || process.cwd()}`);
    serverPromise = startMCPServer(workspacePath || process.cwd());
    
    // Add timeout to server startup
    const timeoutPromise = new Promise<http.Server>((_, reject) => {
      setTimeout(() => reject(new Error('Server startup timed out after 30s')), 30000); // Increased timeout
    });
    
    log('Waiting for server to start...');
    mcpServer = await Promise.race([serverPromise, timeoutPromise]);
    
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
      
      log('Setting up server event listeners...');
      mcpServer.once('listening', () => {
        log('Server listening event received');
        resolve();
      });
      mcpServer.once('error', (err) => {
        log(`Server error event received: ${err}`, 'error');
        reject(err);
      });
    });
    
    const serverPort = getServerPort(mcpServer);
    log(`Checking server port: ${serverPort}`);
    
    if (!serverPort) {
      throw new Error('Failed to get server port after starting server');
    }
    
    // Verify server is actually listening
    log('Verifying server health...');
    const isListening = await checkServerHealth();
    if (!isListening) {
      throw new Error(`Server started but not responding on port ${serverPort}`);
    }
    
    log(`Server started and verified on port ${serverPort}`);

    // Create or update status bar item
    if (!serverStatusItem) {
      serverStatusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      serverStatusItem.tooltip = "MCP Server Status";
      serverStatusItem.command = 'mcpTools.copyUrl';
    }
    serverStatusItem.show();

    // Start health check interval
    setInterval(updateServerStatus, 5000);

    log('Server started successfully');
    retryCount = 0; // Reset retry count on success
    
    // Initial status update
    await updateServerStatus();

    return serverPort;
  } catch (error) {
    const attempt = retryCount + 1;
    log(`Failed to start server (attempt ${attempt}/${MAX_RETRIES}): ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn');
    
    if (error instanceof Error) {
      log(`Error stack: ${error.stack}`, 'error');
    }
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      // Clean up any existing server instance
      if (mcpServer) {
        try {
          await new Promise<void>((resolve) => {
            mcpServer?.close(() => resolve());
          });
        } catch (closeError) {
          log(`Error closing server: ${closeError}`, 'warn');
        }
        mcpServer = undefined;
      }
      
      log(`Retrying server start in ${RETRY_DELAY}ms...`);
      return new Promise((resolve) => {
        setTimeout(() => {
          tryStartServer().then(resolve).catch((retryError) => {
            log(`Retry failed: ${retryError}`, 'error');
            resolve(0); // Return 0 to indicate failure
          });
        }, RETRY_DELAY);
      });
    } else {
      log('Failed to start server after maximum retries', 'error');
      vscode.window.showErrorMessage('Failed to start MCP server after multiple attempts');
      throw error;
    }
  }
}

export async function activate(context: vscode.ExtensionContext) {
    log('MCP Tools extension is activating');
    
    // Initialize debug mode
    setupDebugMode(context);
    
    // Create status bar item for server status
    serverStatusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    serverStatusItem.text = "$(sync~spin) MCP: Starting...";
    serverStatusItem.tooltip = "MCP Server Status";
    serverStatusItem.show();
    context.subscriptions.push(serverStatusItem);

    // Set up logging callback
    setLogCallback(log);

    // Create exports object with getWebviewPanel function
    const exports = {
        getWebviewPanel: () => {
            const panel = MyToolsPanel.getWebviewPanel();
            if (!panel) {
                log('Warning: getWebviewPanel returned null', 'warn');
            }
            return panel;
        },
        getServerPort: () => {
            const port = getServerPort(mcpServer);
            if (!port) {
                log('Warning: getServerPort returned null', 'warn');
            }
            return port;
        }
    };

    try {
        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mcpTools.openPanel', async () => {
                try {
                    // Create panel first without server port
                    await MyToolsPanel.createOrShow(context.extensionUri);
                    
                    // Panel will request workspace path and then we'll start server
                    const panel = MyToolsPanel.getWebviewPanel();
                    if (!panel) {
                        throw new Error('Panel not created');
                    }

                    panel.webview.onDidReceiveMessage(async (message) => {
                        if (message.type === 'GET_WORKSPACE_PATH') {
                            // Start server after receiving workspace path request
                            const port = await tryStartServer();
                            if (!port) {
                                throw new Error('Failed to start server - no port returned');
                            }
                            
                            // Verify server is healthy before proceeding
                            const isHealthy = await checkServerHealth();
                            if (!isHealthy) {
                                throw new Error('Server started but health check failed');
                            }
                            
                            log(`Server started successfully on port ${port}`);
                            
                            // Send workspace path back to panel
                            panel.webview.postMessage({
                                type: 'WORKSPACE_PATH',
                                path: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                                serverPort: port
                            });
                        }
                    });
                } catch (error) {
                    log(`Error opening panel: ${error}`, 'error');
                    vscode.window.showErrorMessage(`Failed to open MCP Tools panel: ${error}`);
                }
            }),
            vscode.commands.registerCommand('mcpTools.copyUrl', () => {
                const serverPort = getServerPort(mcpServer);
                if (serverPort) {
                    vscode.env.clipboard.writeText(`http://localhost:${serverPort}`);
                    vscode.window.showInformationMessage('MCP server URL copied to clipboard');
                }
            })
        );

        // Set up periodic health checks
        const healthCheckInterval = setInterval(updateServerStatus, 5000);
        context.subscriptions.push({ dispose: () => clearInterval(healthCheckInterval) });

        log('Extension activated successfully');
        return exports;
    } catch (error) {
        log(`Error during activation: ${error}`, 'error');
        vscode.window.showErrorMessage(`Failed to activate MCP Tools: ${error}`);
        // Return exports even if there was an error, to maintain the expected interface
        return exports;
    }
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