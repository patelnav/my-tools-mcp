import * as vscode from 'vscode';
import { startMCPServer } from './server';
import { MyToolsPanel } from './panel/MyToolsPanel';

let mcpServer: ReturnType<typeof startMCPServer>;

export function activate(context: vscode.ExtensionContext) {
  console.log('MCP Tools extension is now active');

  // Start MCP server
  mcpServer = startMCPServer();

  // Create status bar item to show MCP URL
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "MCP URL: http://localhost:8080";
  statusBarItem.tooltip = "Click to copy MCP URL";
  statusBarItem.command = 'mcpTools.copyUrl';
  statusBarItem.show();

  // Register commands
  let disposables = [
    vscode.commands.registerCommand('mcpTools.openPanel', () => {
      MyToolsPanel.createOrShow(context.extensionUri);
    }),

    vscode.commands.registerCommand('mcpTools.copyUrl', () => {
      vscode.env.clipboard.writeText('http://localhost:8080').then(() => {
        vscode.window.showInformationMessage('MCP URL copied to clipboard');
      });
    }),

    statusBarItem
  ];

  context.subscriptions.push(...disposables);
}

export function deactivate() {
  if (mcpServer) {
    mcpServer.close(() => {
      console.log('MCP server closed');
    });
  }
} 