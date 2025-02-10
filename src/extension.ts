import * as vscode from 'vscode';
import { MyToolsPanel } from './panel/MyToolsPanel';
import http from 'http';
import type { AddressInfo } from 'net';
import { startExtensionServer } from './server';
import type { ExtensionServer } from './server';
import { initializeLogging, logInfo, logError, logWarn } from '@/utils/logging';

let serverStatusItem: vscode.StatusBarItem;
let mcpServer: ExtensionServer | undefined;

// Debug mode configuration
const DEBUG_MODE = true;
let debugStatusBar: vscode.StatusBarItem | undefined;
let isDebugInitialized = false;

// Export for testing
export function getServerPort(): number | undefined {
  if (!mcpServer) {
    logWarn('Extension', 'Server is undefined when getting port');
    return undefined;
  }
  return mcpServer.port;
}

async function startServer(): Promise<number> {
  try {
    if (mcpServer) {
      const port = getServerPort();
      if (port) {
        logInfo('Extension', 'Server already running', { port });
        return port;
      }
      // If we can't get the port, stop the server and start a new one
      await stopServer();
    }

    mcpServer = await startExtensionServer({
      fixedPort: 54321  // Use fixed port for now
    });

    const port = mcpServer.port;
    logInfo('Extension', 'Server started', { port });

    // Update status bar
    serverStatusItem.text = `$(radio-tower) MCP: Connected (${port})`;
    serverStatusItem.backgroundColor = undefined;

    return port;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Extension', 'Error starting server', { error: message });
    throw error;
  }
}

async function stopServer(): Promise<void> {
  if (!mcpServer) {
    logInfo('Extension', 'Server already stopped');
    return;
  }

  try {
    await mcpServer.cleanup();
    mcpServer = undefined;
    serverStatusItem.text = "$(circle-slash) MCP: Stopped";
    logInfo('Extension', 'Server stopped successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Extension', 'Error stopping server', { error: message });
    throw error;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  logInfo('Extension', 'MCP Tools extension is activating');

  try {
    // Create status bar items
    serverStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    serverStatusItem.text = "$(sync~spin) MCP: Starting...";
    serverStatusItem.show();
    context.subscriptions.push(serverStatusItem);

    // Initialize debug status bar if needed
    if (DEBUG_MODE) {
      debugStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        1000
      );
      debugStatusBar.text = "$(bug) MCP Debug: Starting...";
      debugStatusBar.tooltip = "MCP Debug Status";
      debugStatusBar.show();
      context.subscriptions.push(debugStatusBar);
      isDebugInitialized = true;
    }

    // Initialize logging system
    initializeLogging(
      MyToolsPanel.currentPanel,
      debugStatusBar,
      DEBUG_MODE
    );

    // Start server
    const port = await startServer();

    // Create WebView panel
    MyToolsPanel.createOrShow(context.extensionUri, port);
    
    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('mcpTools.openPanel', () => {
        MyToolsPanel.createOrShow(context.extensionUri, getServerPort());
      }),
      vscode.commands.registerCommand('mcpTools.startServer', startServer),
      vscode.commands.registerCommand('mcpTools.stopServer', stopServer)
    );

    logInfo('Extension', 'Extension activated successfully');

    // Return exports for testing
    return {
      getWebviewPanel: () => MyToolsPanel.getWebviewPanel(),
      getServerPort: () => getServerPort(),
      checkServerHealth: async () => {
        try {
          const port = getServerPort();
          if (!port) return false;
          
          const response = await fetch(`http://localhost:${port}/health`);
          return response.ok;
        } catch {
          return false;
        }
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Extension', 'Extension activation failed', { error: message });
    throw error;
  }
}

export function deactivate() {
  if (mcpServer) {
    mcpServer.cleanup().catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      logError('Extension', 'Error during cleanup', { error: message });
    });
  }
} 